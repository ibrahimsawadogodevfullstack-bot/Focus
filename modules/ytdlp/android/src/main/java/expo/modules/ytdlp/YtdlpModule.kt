package expo.modules.ytdlp

import android.net.Uri
import android.util.Log
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.locks.ReentrantReadWriteLock
import java.util.regex.Pattern
import org.json.JSONArray
import org.json.JSONObject

/**
 * Erreur native portant un code stable que l'interface traduit.
 *
 * Le message reste le détail technique de yt-dlp : il est affiché dans la
 * section repliable « Détail technique », jamais tel quel à l'utilisateur.
 */
class YtdlpException(
  code: String,
  message: String,
  cause: Throwable? = null,
) : CodedException(code, message, cause)

/**
 * Module natif Android autour de yt-dlp (`youtubedl-android`).
 *
 * L'API exposée est volontairement minimale :
 *  - `getVersion()` : version de yt-dlp embarquée,
 *  - `update()` : met à jour le binaire yt-dlp depuis GitHub (canal stable),
 *  - `getMetadata(url)` : titre, chaîne, durée et miniature,
 *  - `download(options)` : lance un téléchargement en tâche de fond et renvoie
 *    immédiatement un identifiant de processus,
 *  - `cancel(processId)` : interrompt le processus et nettoie le partiel.
 *
 * La progression et la fin du travail sont poussées par événements, ce qui
 * évite de bloquer le pont JavaScript pendant plusieurs minutes.
 */
class YtdlpModule : Module() {
  private val executor = Executors.newCachedThreadPool { runnable ->
    Thread(runnable, "ytdlp-worker").apply { isDaemon = true }
  }

  @Volatile
  private var initialized = false

  @Volatile
  private var cachedVersion: String? = null

  private val initLock = Any()

  /** Nombre de téléchargements réellement en cours (pour ne pas les casser). */
  private val activeTasks = AtomicInteger(0)

  /**
   * Les mises à jour prennent le verrou en écriture ; téléchargements,
   * métadonnées et listes de chaîne le prennent en lecture. On peut donc
   * lister une chaîne pendant un téléchargement, mais jamais remplacer le
   * binaire yt-dlp pendant qu'un process l'utilise.
   */
  private val updateGuard = ReentrantReadWriteLock()

  /**
   * Initialisation paresseuse : l'extraction de Python et de ffmpeg prend
   * plusieurs secondes au premier lancement. On la fait une seule fois, sur un
   * fil de travail, et on ne bloque jamais le fil principal.
   */
  private fun ensureInitialized() {
    if (initialized) return
    synchronized(initLock) {
      if (initialized) return
      val context = appContext.reactContext
        ?: throw YtdlpException("ERR_YTDLP_CONTEXT", "React context unavailable")
      try {
        FFmpeg.getInstance().init(context)
        YoutubeDL.getInstance().init(context)
        initialized = true
      } catch (error: Throwable) {
        throw YtdlpException(
          "ERR_YTDLP_INIT",
          error.localizedMessage ?: "yt-dlp initialization failed",
          error,
        )
      }
    }
  }

  /**
   * `YoutubeDL.version()` ne lit que la préférence écrite lors d'une mise à
   * jour. Sur une installation neuve elle est vide : on exécute alors
   * `yt-dlp --version` pour obtenir la version réellement embarquée.
   */
  private fun resolveVersion(): String {
    cachedVersion?.let { return it }
    ensureInitialized()
    val context = appContext.reactContext
    val stored = try {
      YoutubeDL.getInstance().version(context) ?: YoutubeDL.getInstance().versionName(context)
    } catch (_: Throwable) {
      null
    }
    val version = if (!stored.isNullOrBlank()) {
      stored.trim()
    } else {
      try {
        val request = YoutubeDLRequest("https://www.youtube.com")
        request.addOption("--version")
        // Même verrou en lecture que les autres usages du binaire : on ne lit
        // pas la version pendant un remplacement par `update`.
        val lock = updateGuard.readLock()
        lock.lock()
        try {
          val response = YoutubeDL.getInstance().execute(request)
          response.out.lineSequence().firstOrNull { it.isNotBlank() }?.trim() ?: "unknown"
        } finally {
          lock.unlock()
        }
      } catch (error: Throwable) {
        throw YtdlpException(
          "ERR_YTDLP_VERSION",
          error.localizedMessage ?: "Unable to read yt-dlp version",
          error,
        )
      }
    }
    cachedVersion = version
    return version
  }

  /** Concatène le message et ses causes (yt-dlp met le détail utile en cause). */
  private fun errorText(error: Throwable): String = buildString {
    append(error.localizedMessage ?: "")
    var cause = error.cause
    while (cause != null && length < 4000) {
      append('\n')
      append(cause.localizedMessage ?: "")
      cause = cause.cause
    }
  }.trim().ifEmpty { "yt-dlp failed" }

  private val storageMarkers = listOf(
    "no space left",
    "not enough space",
    "errno 28",
    "disk quota",
    "read-only file system",
    "errno 30",
  )

  private val rateLimitMarkers = listOf(
    "http error 429",
    "too many requests",
    "rate limit",
    "rate-limit",
  )

  /** Flux refusé par YouTube : format, jeton PO, signature. */
  private val formatMarkers = listOf(
    "http error 403",
    "forbidden",
    "requested format is not available",
    "requested format not available",
    "no video formats found",
    "only images are available",
    "signature extraction failed",
    "unable to extract video data",
  )

  /** Vidéo réellement indisponible (privée, âge, pays, robot). */
  private val authMarkers = listOf(
    "sign in to confirm",
    "confirm you",
    "not a bot",
    "age-restricted",
    "age restricted",
    "private video",
    "video unavailable",
    "this video is not available",
    "has been removed",
    "not available in your country",
  )

  private val fileMarkers = listOf(
    "unable to rename file",
    "no such file or directory",
    "permission denied",
    "errno 2",
    "errno 13",
  )

  private val mergeMarkers = listOf(
    "ffmpeg",
    "conversion failed",
    "postprocessing",
    "merger",
  )

  /**
   * Marqueurs réseau *précis*.
   *
   * On évite volontairement les mots trop larges utilisés auparavant
   * (« connection », « unable to download », « timed out ») : ils apparaissent
   * aussi dans des erreurs de format, de quota ou de fusion ffmpeg. Chaque
   * erreur classée `ERR_YTDLP_NETWORK` met la file en pause et affiche « pas de
   * connexion Internet » : un faux positif accusait donc l'utilisateur à tort.
   */
  private val networkMarkers = listOf(
    "getaddrinfo",
    "no address associated",
    "name or service not known",
    "failed to resolve",
    "name resolution",
    "temporary failure",
    "network is unreachable",
    "network is down",
    "errno 7",
    "connection reset",
    "connection refused",
    "connection aborted",
    "remote end closed",
    "closed connection",
    "incompleteread",
    "read timed out",
    "urlopen error",
    "certificate verify",
    "unable to download webpage",
    "http error 500",
    "http error 502",
    "http error 503",
    "http error 504",
  )

  /** Traduit une sortie yt-dlp en code compréhensible par l'interface. */
  private fun classifyError(error: Throwable): Pair<String, String> {
    if (error is YoutubeDL.CanceledException) {
      return "ERR_YTDLP_CANCELED" to "Download canceled"
    }
    val message = errorText(error)
    val lower = message.lowercase()
    fun has(markers: List<String>) = markers.any { lower.contains(it) }

    // L'ordre compte : un 403 « unable to download video data » ne doit pas
    // passer pour une panne réseau, et un « No space left » pour un format.
    val code = when {
      has(storageMarkers) -> "ERR_YTDLP_STORAGE"
      has(rateLimitMarkers) -> "ERR_YTDLP_RATE_LIMIT"
      has(formatMarkers) -> "ERR_YTDLP_FORMAT"
      has(authMarkers) -> "ERR_YTDLP_UNAVAILABLE"
      has(fileMarkers) -> "ERR_YTDLP_FILE"
      has(mergeMarkers) -> "ERR_YTDLP_MERGE"
      has(networkMarkers) -> "ERR_YTDLP_NETWORK"
      lower.contains("is not a valid url") ||
        lower.contains("unsupported url") ||
        lower.contains("invalid url") -> "ERR_YTDLP_INVALID_URL"
      else -> "ERR_YTDLP_FAILED"
    }
    return code to message
  }

  /**
   * Tri des formats (option `-S`).
   *
   * `res:$height` choisit la résolution la plus proche de la cible sans
   * supposer l'orientation : pour une vidéo verticale, `height` vaut 1280 en
   * 720p, donc un filtre `height<=720` retomberait sur du 360p.
   *
   * H.264/AAC/MP4 est privilégié car c'est le couple le plus largement
   * décodable sur Android ; les autres codecs servent de repli si absents.
   */
  private fun qualitySort(quality: String): String {
    val height = when (quality) {
      "480p" -> 480
      "1080p" -> 1080
      else -> 720
    }
    return "res:$height,vcodec:h264,acodec:aac,ext:mp4"
  }

  /**
   * YouTube renvoie régulièrement un HTTP 403 sur les flux DASH (vidéo seule)
   * quand aucun jeton PO n'est disponible. Le format progressif `b` (audio +
   * vidéo dans un seul fichier MP4) reste, lui, téléchargeable sans jeton :
   * c'est notre filet de sécurité pour que le téléchargement aboutisse.
   */
  private fun isFormatBlocked(error: Throwable): Boolean {
    if (error is YoutubeDL.CanceledException) return false
    val lower = errorText(error).lowercase()
    return formatMarkers.any { lower.contains(it) } ||
      lower.contains("unable to download video data")
  }

  /**
   * `expo-file-system` expose ses dossiers sous forme d'URI (`file:///data/...`).
   * `java.io.File` ne comprend pas ce préfixe : il le traite comme un chemin
   * relatif, ce qui faisait échouer `mkdirs()` sur Android (`/` est en lecture
   * seule). On convertit donc systématiquement l'URI en chemin natif.
   */
  private fun nativePath(value: String): String {
    val parsed = Uri.parse(value)
    return if (parsed.scheme == "file") {
      parsed.path ?: value
    } else {
      value
    }
  }

  /** Nom de fichier sûr : l'identifiant YouTube ne contient que [A-Za-z0-9_-]. */
  private fun safeBaseName(value: String): String {
    val cleaned = value.replace(Regex("[^A-Za-z0-9_-]"), "_").trim('_')
    return cleaned.ifEmpty { UUID.randomUUID().toString() }
  }

  private val ignoredExtensions = setOf(
    "part", "ytdl", "temp", "frag", "json", "description", "jpg", "jpeg", "png", "webp",
  )

  /**
   * Retrouve le fichier final produit par yt-dlp. On scanne le dossier plutôt
   * que de dépendre des lignes de log : selon le format choisi, yt-dlp fusionne
   * (`Merger`) ou convertit (`ExtractAudio`), et le nom exact varie.
   *
   * Les flux DASH intermédiaires (`<base>.f137.mp4`, `<base>.f251.webm`) sont
   * écartés tant qu'un fichier fusionné existe : après un repli de format, un
   * flux vidéo seul peut être plus gros que le MP4 complet et serait choisi à
   * tort (vidéo sans son).
   */
  private val formatStreamFile = Regex("""\.f\d+\.[A-Za-z0-9]+$""")

  private fun findOutputFile(directory: File, baseName: String): File? {
    val candidates = directory.listFiles { file ->
      file.isFile &&
        file.name.startsWith("$baseName.") &&
        file.extension.lowercase() !in ignoredExtensions
    } ?: return null
    if (candidates.isEmpty()) return null
    val merged = candidates.filterNot { formatStreamFile.containsMatchIn(it.name) }
    return (merged.ifEmpty { candidates.toList() }).maxByOrNull { it.length() }
  }

  /** Un `.part` existe : une nouvelle tentative peut reprendre au lieu de zéro. */
  private fun hasPartialFile(directory: File, baseName: String): Boolean =
    directory.listFiles { file ->
      file.isFile && file.name.startsWith("$baseName.") && file.extension == "part"
    }?.isNotEmpty() == true

  /** Supprime les restes d'un téléchargement annulé (`.part`, fragments, etc.). */
  private fun deletePartialFiles(directory: File, baseName: String) {
    directory.listFiles { file ->
      file.isFile && file.name.startsWith("$baseName.")
    }?.forEach { runCatching { it.delete() } }
  }

  private fun cleanupStaleFiles(directory: File, baseName: String) {
    directory.listFiles { file ->
      file.isFile && file.name.startsWith("$baseName.") && file.extension.lowercase() in
        setOf("part", "ytdl", "temp", "frag")
    }?.forEach { runCatching { it.delete() } }
  }

  /**
   * Supprime les flux DASH complets (`<base>.f137.mp4`, `<base>.f251.webm`).
   *
   * Inutilisables seuls (vidéo sans son), ils fausseraient aussi la recherche
   * du fichier final après un repli de format.
   */
  private fun deleteFormatStreamFiles(directory: File, baseName: String) {
    directory.listFiles { file ->
      file.isFile &&
        file.name.startsWith("$baseName.") &&
        file.extension != "part" &&
        formatStreamFile.containsMatchIn(file.name)
    }?.forEach { runCatching { it.delete() } }
  }

  /**
   * Lit les métadonnées écrites par `--write-info-json` (`<base>.info.json`).
   *
   * Cela évite un second appel à yt-dlp rien que pour la durée : le JSON est
   * produit pendant l'extraction que le téléchargement fait déjà. Le fichier
   * est supprimé dans tous les cas.
   */
  private fun readDownloadMetadata(directory: File, baseName: String): Map<String, Any?>? {
    val file = File(directory, "$baseName.info.json")
    if (!file.isFile) return null
    return try {
      val json = JSONObject(file.readText())
      fun text(key: String): String? =
        (json.opt(key) as? String)?.takeIf { it.isNotBlank() }
      val duration = (json.opt("duration") as? Number)?.toDouble() ?: 0.0
      mapOf(
        "title" to text("title"),
        "channelName" to (text("uploader") ?: text("channel") ?: text("creator")),
        "durationSec" to if (duration > 0) duration else null,
        "thumbnailUrl" to text("thumbnail"),
      )
    } catch (_: Throwable) {
      null
    } finally {
      runCatching { file.delete() }
    }
  }

  private val speedPattern = Pattern.compile("""at\s+([0-9.]+\s*[KMG]i?B/s)""")
  private val channelIdPattern = Pattern.compile("^UC[A-Za-z0-9_-]{22}$")

  private fun extractSpeed(line: String): String? {
    val matcher = speedPattern.matcher(line)
    return if (matcher.find()) matcher.group(1)?.trim() else null
  }

  override fun definition() = ModuleDefinition {
    Name("Ytdlp")

    Events("onProgress", "onComplete", "onError", "onVersion")

    // Aucune initialisation au démarrage : l'extraction Python/ffmpeg (plusieurs
    // secondes) est différée au premier usage (getVersion / getMetadata /
    // download). L'application démarre donc immédiatement ; la version yt-dlp
    // s'affiche dès que le module est prêt.
    AsyncFunction("getVersion") {
      resolveVersion()
    }

    /**
     * Met à jour le binaire yt-dlp depuis les releases GitHub (canal stable).
     *
     * YouTube casse régulièrement les versions anciennes : yt-dlp avertit
     * au-delà de 90 jours et les téléchargements finissent en 403. La
     * bibliothèque télécharge le nouveau script et le substitue à celui
     * embarqué dans l'APK ; la mise à jour survit donc aux redémarrages.
     *
     * Renvoie `{ version, updated, skipped? }`. `skipped = "busy"` signifie
     * qu'un téléchargement est en cours et qu'il ne faut pas remplacer le
     * binaire sous ses pieds ; l'appelant pourra réessayer plus tard.
     */
    AsyncFunction("update") {
      ensureInitialized()
      val context = appContext.reactContext
        ?: throw YtdlpException("ERR_YTDLP_CONTEXT", "React context unavailable")

      // Ne pas bloquer une mise à jour derrière un long téléchargement : on
      // répond « occupé » immédiatement. Le verrou en écriture couvre la
      // course restante (un téléchargement qui démarre juste après attendra
      // la fin de la mise à jour).
      if (activeTasks.get() > 0) {
        return@AsyncFunction mapOf(
          "version" to resolveVersion(),
          "updated" to false,
          "skipped" to "busy",
        )
      }

      // Le verrou est tenu en écriture pendant toute la mise à jour : un
      // téléchargement ou un listing qui démarre en parallèle attend le
      // remplacement complet du binaire au lieu de l'utiliser à moitié écrasé.
      val lock = updateGuard.writeLock()
      lock.lock()
      try {
        if (activeTasks.get() > 0) {
          mapOf(
            "version" to resolveVersion(),
            "updated" to false,
            "skipped" to "busy",
          )
        } else {
          try {
            val status = YoutubeDL.getInstance()
              .updateYoutubeDL(context, YoutubeDL.UpdateChannel.STABLE)
            // Le binaire a changé : la version en cache n'est plus valable.
            cachedVersion = null
            val version = resolveVersion()
            if (status == YoutubeDL.UpdateStatus.DONE) {
              sendEvent("onVersion", mapOf("version" to version))
            }
            mapOf(
              "version" to version,
              "updated" to (status == YoutubeDL.UpdateStatus.DONE),
            )
          } catch (error: Throwable) {
            throw YtdlpException(
              "ERR_YTDLP_UPDATE",
              error.localizedMessage ?: "yt-dlp update failed",
              error,
            )
          }
        }
      } finally {
        lock.unlock()
      }
    }

    AsyncFunction("getMetadata") { url: String ->
      ensureInitialized()
      try {
        val context = appContext.reactContext
          ?: throw YtdlpException("ERR_YTDLP_CONTEXT", "React context unavailable")
        // Verrou en lecture : l'extraction peut cohabiter avec d'autres
        // lectures (listing de chaîne, téléchargement) mais pas avec le
        // remplacement du binaire yt-dlp par `update`.
        val lock = updateGuard.readLock()
        lock.lock()
        try {
          val request = YoutubeDLRequest(url)
          request.addOption("--no-playlist")
          request.addOption("--no-warnings")
          request.addOption("--cache-dir", File(context.cacheDir, "yt-dlp").absolutePath)
          val info = YoutubeDL.getInstance().getInfo(request)
          mapOf(
            "videoId" to (info.id ?: ""),
            "title" to (info.title ?: info.fulltitle ?: "Vidéo"),
            "channelName" to (info.uploader ?: ""),
            "durationSec" to info.duration,
            "thumbnailUrl" to (info.thumbnail ?: ""),
          )
        } finally {
          lock.unlock()
        }
      } catch (error: Throwable) {
        val (code, message) = classifyError(error)
        throw YtdlpException(code, message, error)
      }
    }

    /**
     * Liste une page de vidéos d'une chaîne (onglet « Vidéos »), sans
     * téléchargement ni extraction complète.
     *
     * yt-dlp renvoie une playlist aplatie (`--flat-playlist`) : identifiant,
     * titre, durée et nombre de vues, mais pas de date de publication.
     * `hasMore` est vrai quand la page est pleine : l'appelant peut alors
     * demander la tranche suivante.
     */
    AsyncFunction("listChannelVideos") { options: Map<String, Any?> ->
      val channelId = options["channelId"] as? String
        ?: throw YtdlpException("ERR_YTDLP_BAD_ARGUMENT", "Missing channelId")
      if (!channelIdPattern.matcher(channelId).matches()) {
        throw YtdlpException("ERR_YTDLP_BAD_ARGUMENT", "Invalid channelId")
      }
      val start = ((options["start"] as? Number)?.toInt() ?: 1).coerceAtLeast(1)
      val count = ((options["count"] as? Number)?.toInt() ?: 30).coerceIn(1, 50)
      val end = start + count - 1

      ensureInitialized()
      val context = appContext.reactContext
        ?: throw YtdlpException("ERR_YTDLP_CONTEXT", "React context unavailable")

      val lock = updateGuard.readLock()
      lock.lock()
      try {
        val request = YoutubeDLRequest("https://www.youtube.com/channel/$channelId/videos")
        request.addOption("--flat-playlist")
        request.addOption("--playlist-start", start)
        request.addOption("--playlist-end", end)
        request.addOption("--no-warnings")
        // Une page ne doit pas rester bloquée indéfiniment sur un réseau lent.
        request.addOption("--socket-timeout", 15)
        // Le cache accélère l'extraction, comme pour les téléchargements.
        request.addOption("--cache-dir", File(context.cacheDir, "yt-dlp").absolutePath)
        request.addOption("--dump-single-json")
        val response = YoutubeDL.getInstance().execute(request)
        val entries = JSONObject(response.out).optJSONArray("entries") ?: JSONArray()
        val videos = ArrayList<Map<String, Any?>>(entries.length())
        for (index in 0 until entries.length()) {
          val entry = entries.optJSONObject(index) ?: continue
          val videoId = entry.optString("id").takeIf { it.isNotBlank() } ?: continue
          videos.add(
            mapOf(
              "videoId" to videoId,
              "title" to (entry.optString("title").takeIf { it.isNotBlank() } ?: "Vidéo"),
              "durationSec" to ((entry.opt("duration") as? Number)?.toInt() ?: 0),
              "viewCount" to ((entry.opt("view_count") as? Number)?.toLong() ?: 0L),
              // Miniature stable : les URLs signées renvoyées par yt-dlp
              // finissent par expirer, celle-ci reste valable.
              "thumbnailUrl" to "https://i.ytimg.com/vi/$videoId/hqdefault.jpg",
            ),
          )
        }
        mapOf(
          "videos" to videos,
          "hasMore" to (entries.length() >= count),
        )
      } catch (error: Throwable) {
        val (code, message) = classifyError(error)
        throw YtdlpException(code, message, error)
      } finally {
        lock.unlock()
      }
    }

    AsyncFunction("download") { options: Map<String, Any?> ->
      val url = options["url"] as? String
        ?: throw YtdlpException("ERR_YTDLP_BAD_ARGUMENT", "Missing url")
      val requestId = options["id"] as? String
        ?: throw YtdlpException("ERR_YTDLP_BAD_ARGUMENT", "Missing id")
      val outDir = (options["outDir"] as? String)
        ?.let(::nativePath)
        ?: throw YtdlpException("ERR_YTDLP_BAD_ARGUMENT", "Missing outDir")
      val baseName = safeBaseName(options["fileName"] as? String ?: UUID.randomUUID().toString())
      val format = (options["format"] as? String ?: "video").lowercase()
      val quality = options["quality"] as? String ?: "720p"
      // Libellé déjà traduit par l'interface : le module n'embarque pas d'i18n.
      val notificationLabel = options["notificationLabel"] as? String ?: "Focus"

      ensureInitialized()
      val context = appContext.reactContext
        ?: throw YtdlpException("ERR_YTDLP_CONTEXT", "React context unavailable")

      val directory = File(outDir)
      if (!directory.exists() && !directory.mkdirs()) {
        throw YtdlpException("ERR_YTDLP_STORAGE", "Unable to create $outDir")
      }

      val processId = UUID.randomUUID().toString()

      /** Lance yt-dlp avec un sélecteur de format et relaie la progression. */
      fun runYtdlp(selector: String) {
        val request = YoutubeDLRequest(url).apply {
          addOption("--no-playlist")
          addOption("--newline")
          addOption("--no-mtime")
          // Une vidéo d'une heure représente des milliers de fragments DASH :
          // les valeurs par défaut (3 essais) s'épuisent au premier incident.
          // Ces réglages visent une reprise silencieuse plutôt qu'un échec.
          addOption("--retries", 10)
          addOption("--fragment-retries", 10)
          addOption("--extractor-retries", 3)
          addOption("--file-access-retries", 3)
          addOption("--socket-timeout", 30)
          addOption("--retry-sleep", 3)
          // Trois connexions parallèles : un téléchargement long finit avant
          // que YouTube ne coupe le flux, et l'avancement est plus régulier.
          addOption("--concurrent-fragments", 3)
          // Le cache de yt-dlp accélère l'extraction (scripts du lecteur) ;
          // la bibliothèque le désactive par défaut.
          addOption("--cache-dir", File(context.cacheDir, "yt-dlp").absolutePath)
          // Durée/titre/chaîne : récupérés depuis l'extraction déjà faite pour
          // le téléchargement, sans second appel à yt-dlp.
          addOption("--write-info-json")
          addOption("-o", File(directory, "$baseName.%(ext)s").absolutePath)
          addOption("-f", selector)
          if (format == "audio") {
            addOption("-x")
            addOption("--audio-format", "mp3")
            addOption("--audio-quality", "0")
          } else {
            addOption("-S", qualitySort(quality))
            addOption("--merge-output-format", "mp4")
          }
        }
        YoutubeDL.getInstance().execute(request, processId) { progress, eta, line ->
          val normalized = when {
            progress < 0f -> 0.0
            progress > 100f -> 1.0
            else -> (progress / 100f).toDouble()
          }
          Log.i("Ytdlp", line)
          YtdlpDownloadService.updateProgress(context, (normalized * 100).toInt())
          sendEvent(
            "onProgress",
            mapOf(
              "id" to requestId,
              "processId" to processId,
              "progress" to normalized,
              "percent" to (normalized * 100),
              "etaSeconds" to eta,
              "speed" to extractSpeed(line),
              "detail" to line,
            ),
          )
        }
      }

      executor.execute {
        // Verrou en lecture pendant tout le téléchargement : il peut cohabiter
        // avec d'autres lectures, mais bloque le remplacement du binaire par
        // `update` tant qu'un process yt-dlp tourne.
        val lock = updateGuard.readLock()
        lock.lock()
        val running = activeTasks.incrementAndGet()
        // Premier fichier de la file : on passe en service de premier plan avant
        // de lancer yt-dlp. Sans lui, Android gèle le processus dès que
        // l'application passe en arrière-plan et une vidéo d'une heure échoue.
        if (running == 1) YtdlpDownloadService.start(context, notificationLabel)
        try {
          val primary = if (format == "audio") "ba/b" else "bv*+ba/b"
          try {
            runYtdlp(primary)
          } catch (error: Throwable) {
            if (!isFormatBlocked(error)) throw error
            Log.w("Ytdlp", "flux refusé par YouTube, nouvelle tentative", error)
            if (hasPartialFile(directory, baseName)) {
              // Un `.part` existe : on relance le même sélecteur pour reprendre
              // à l'endroit exact où yt-dlp s'est arrêté, au lieu de perdre 30
              // minutes de téléchargement.
              try {
                runYtdlp(primary)
              } catch (retryError: Throwable) {
                if (!isFormatBlocked(retryError)) throw retryError
                Log.w("Ytdlp", "flux toujours refusé, repli sur le format progressif", retryError)
                deletePartialFiles(directory, baseName)
                deleteFormatStreamFiles(directory, baseName)
                runYtdlp("b")
              }
            } else {
              // Échec immédiat : rien à reprendre. Le format progressif
              // (vidéo + audio dans un seul MP4) reste téléchargeable sans
              // jeton PO. En audio, ffmpeg extrait la piste.
              deleteFormatStreamFiles(directory, baseName)
              runYtdlp("b")
            }
          }

          val output = findOutputFile(directory, baseName)
          if (output == null) {
            throw YtdlpException(
              "ERR_YTDLP_OUTPUT",
              "yt-dlp finished but no output file was found in $outDir",
            )
          }
          cleanupStaleFiles(directory, baseName)
          val metadata = readDownloadMetadata(directory, baseName)
          // `expo-file-system` et `expo-video` attendent une URI `file://` :
          // un chemin brut (`/data/...`) est rejeté par `new File(uri)`.
          sendEvent(
            "onComplete",
            mapOf(
              "id" to requestId,
              "processId" to processId,
              "filePath" to "file://${output.absolutePath}",
              "sizeBytes" to output.length(),
              "format" to if (format == "audio") "audio" else "video",
              "metadata" to metadata,
            ),
          )
        } catch (error: Throwable) {
          val (code, message) = classifyError(error)
          // Une annulation doit laisser zéro fichier partiel derrière elle.
          if (code == "ERR_YTDLP_CANCELED") {
            deletePartialFiles(directory, baseName)
          }
          sendEvent(
            "onError",
            mapOf(
              "id" to requestId,
              "processId" to processId,
              "code" to code,
              "message" to message,
            ),
          )
        } finally {
          val remaining = activeTasks.decrementAndGet()
          if (remaining <= 0) YtdlpDownloadService.stop(context)
          lock.unlock()
        }
      }

      processId
    }

    AsyncFunction("cancel") { processId: String ->
      val canceled = runCatching {
        YoutubeDL.getInstance().destroyProcessById(processId)
      }.getOrDefault(false)
      canceled
    }

    OnDestroy {
      executor.shutdownNow()
      appContext.reactContext?.let { YtdlpDownloadService.stop(it) }
    }
  }
}
