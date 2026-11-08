package expo.modules.ytdlp

import android.net.Uri
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
import java.util.regex.Pattern

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
        val response = YoutubeDL.getInstance().execute(request)
        response.out.lineSequence().firstOrNull { it.isNotBlank() }?.trim() ?: "unknown"
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

  /** Traduit une sortie yt-dlp en code compréhensible par l'interface. */
  private fun classifyError(error: Throwable): Pair<String, String> {
    if (error is YoutubeDL.CanceledException) {
      return "ERR_YTDLP_CANCELED" to "Download canceled"
    }
    val raw = buildString {
      append(error.localizedMessage ?: "")
      var cause = error.cause
      // yt-dlp met le détail le plus utile dans la cause ou dans le message.
      while (cause != null && length < 4000) {
        append('\n')
        append(cause.localizedMessage ?: "")
        cause = cause.cause
      }
    }
    val message = raw.trim().ifEmpty { "yt-dlp failed" }
    val lower = message.lowercase()
    val code = when {
      lower.contains("no space left") || lower.contains("not enough space") -> "ERR_YTDLP_STORAGE"
      lower.contains("http error 403") ||
        lower.contains("forbidden") ||
        lower.contains("requested format is not available") -> "ERR_YTDLP_UNAVAILABLE"
      lower.contains("is not a valid url") ||
        lower.contains("unsupported url") ||
        lower.contains("invalid url") -> "ERR_YTDLP_INVALID_URL"
      lower.contains("unable to download") ||
        lower.contains("getaddrinfo") ||
        lower.contains("connection") ||
        lower.contains("network is unreachable") ||
        lower.contains("timed out") ||
        lower.contains("temporary failure") ||
        lower.contains("name or service not known") -> "ERR_YTDLP_NETWORK"
      lower.contains("video unavailable") ||
        lower.contains("this video is not available") ||
        lower.contains("private video") ||
        lower.contains("video has been removed") ||
        lower.contains("confirm you") ||
        lower.contains("sign in to confirm") ||
        lower.contains("age-restricted") ||
        lower.contains("not available in your country") -> "ERR_YTDLP_UNAVAILABLE"
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
    val message = buildString {
      append(error.localizedMessage ?: "")
      var cause = error.cause
      while (cause != null && length < 4000) {
        append('\n')
        append(cause.localizedMessage ?: "")
        cause = cause.cause
      }
    }.lowercase()
    return message.contains("http error 403") ||
      message.contains("forbidden") ||
      message.contains("requested format is not available") ||
      message.contains("unable to download video data")
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
   */
  private fun findOutputFile(directory: File, baseName: String): File? {
    val candidates = directory.listFiles { file ->
      file.isFile &&
        file.name.startsWith("$baseName.") &&
        file.extension.lowercase() !in ignoredExtensions
    } ?: return null
    return candidates.maxByOrNull { it.length() }
  }

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

  private val speedPattern = Pattern.compile("""at\s+([0-9.]+\s*[KMG]i?B/s)""")

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

    AsyncFunction("getMetadata") { url: String ->
      ensureInitialized()
      try {
        val request = YoutubeDLRequest(url)
        request.addOption("--no-playlist")
        request.addOption("--no-warnings")
        val info = YoutubeDL.getInstance().getInfo(request)
        mapOf(
          "videoId" to (info.id ?: ""),
          "title" to (info.title ?: info.fulltitle ?: "Vidéo"),
          "channelName" to (info.uploader ?: ""),
          "durationSec" to info.duration,
          "thumbnailUrl" to (info.thumbnail ?: ""),
        )
      } catch (error: Throwable) {
        val (code, message) = classifyError(error)
        throw YtdlpException(code, message, error)
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

      ensureInitialized()

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
          addOption("--retries", 3)
          addOption("--fragment-retries", 3)
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
        try {
          try {
            runYtdlp(if (format == "audio") "ba/b" else "bv*+ba/b")
          } catch (error: Throwable) {
            if (!isFormatBlocked(error)) throw error
            // YouTube a refusé le flux DASH : on repart sur le format
            // progressif (vidéo + audio dans un seul MP4), qui reste
            // téléchargeable sans jeton PO. En audio, ffmpeg extrait la
            // piste du fichier progressif.
            deletePartialFiles(directory, baseName)
            runYtdlp("b")
          }

          val output = findOutputFile(directory, baseName)
          if (output == null) {
            throw YtdlpException(
              "ERR_YTDLP_OUTPUT",
              "yt-dlp finished but no output file was found in $outDir",
            )
          }
          cleanupStaleFiles(directory, baseName)
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
    }
  }
}
