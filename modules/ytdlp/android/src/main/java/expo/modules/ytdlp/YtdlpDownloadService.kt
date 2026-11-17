package expo.modules.ytdlp

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Service de premier plan qui garde le téléchargement en vie.
 *
 * yt-dlp tourne dans un thread du processus de l'application. Sans service de
 * premier plan, Android gèle ce processus dès que l'application passe en
 * arrière-plan (app freezer, Doze, gestionnaires constructeurs) : les sockets
 * expirent, les essais de yt-dlp s'épuisent et une vidéo d'une heure échoue
 * forcément, alors qu'une vidéo courte a le temps de finir. Le service affiche
 * la progression dans la barre de notifications et tient un wake lock partiel
 * (l'écran peut s'éteindre : c'est le processeur qui doit rester éveillé).
 *
 * Aucune logique métier ici : le module pilote le cycle de vie (démarrage au
 * premier téléchargement, arrêt à la fin du dernier).
 */
class YtdlpDownloadService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel(this)
    acquireWakeLock()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val label = intent?.getStringExtra(EXTRA_LABEL) ?: DEFAULT_LABEL
    currentLabel = label
    // `startForeground` doit suivre `startForegroundService` de quelques
    // secondes, sinon Android termine le processus avec une ANR système.
    try {
      val notification = buildNotification(this, label, 0)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (error: Throwable) {
      Log.w(TAG, "startForeground impossible", error)
      stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    super.onDestroy()
  }

  @SuppressLint("WakelockTimeout")
  private fun acquireWakeLock() {
    try {
      val power = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
      wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Focus:downloads").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (error: Throwable) {
      Log.w(TAG, "wake lock indisponible", error)
    }
  }

  private fun releaseWakeLock() {
    try {
      wakeLock?.takeIf { it.isHeld }?.release()
    } catch (_: Throwable) {
      // Le wake lock peut déjà avoir été libéré par le système.
    }
    wakeLock = null
  }

  companion object {
    private const val TAG = "YtdlpService"
    private const val CHANNEL_ID = "focus-downloads"
    private const val CHANNEL_NAME = "Downloads"
    private const val NOTIFICATION_ID = 0x0F0C05
    private const val EXTRA_LABEL = "label"
    private const val DEFAULT_LABEL = "Focus"

    @Volatile
    private var started = false

    @Volatile
    private var currentLabel = DEFAULT_LABEL

    private var lastPercent = -1
    private var lastUpdateAt = 0L

    /** Démarre le service une seule fois, quel que soit le nombre de fichiers. */
    fun start(context: Context, label: String) {
      currentLabel = label
      if (started) return
      val intent = Intent(context, YtdlpDownloadService::class.java).putExtra(EXTRA_LABEL, label)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        started = true
        lastPercent = -1
      } catch (error: Throwable) {
        // Démarrage refusé (Android 12+ : application en arrière-plan, ou
        // quota de services). Le téléchargement continue sans notification
        // plutôt que d'échouer.
        Log.w(TAG, "service de premier plan refusé", error)
      }
    }

    fun stop(context: Context) {
      if (!started) return
      started = false
      lastPercent = -1
      try {
        context.stopService(Intent(context, YtdlpDownloadService::class.java))
      } catch (_: Throwable) {
        // Rien à faire : le système a déjà arrêté le service.
      }
    }

    /** Met à jour la notification, au plus une fois par seconde et par point. */
    fun updateProgress(context: Context, percent: Int) {
      if (!started) return
      val bounded = percent.coerceIn(0, 100)
      val now = System.currentTimeMillis()
      if (bounded == lastPercent || now - lastUpdateAt < 1000) return
      lastPercent = bounded
      lastUpdateAt = now
      try {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
          ?: return
        manager.notify(NOTIFICATION_ID, buildNotification(context, currentLabel, bounded))
      } catch (_: Throwable) {
        // Une notification ratée ne doit jamais interrompre un téléchargement.
      }
    }

    private fun createChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      try {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
          ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_LOW,
        ).apply {
          description = "Downloads"
          setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
      } catch (_: Throwable) {
        // Canal impossible à créer : la notification restera silencieuse.
      }
    }

    private fun buildNotification(context: Context, label: String, percent: Int): Notification {
      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle(label)
        .setContentText("$percent%")
        .setOnlyAlertOnce(true)
        .setOngoing(true)
        .setSilent(true)
        .setProgress(100, percent, percent <= 0)
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) {
        builder.setContentIntent(
          PendingIntent.getActivity(
            context,
            0,
            launch,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
          ),
        )
      }
      return builder.build()
    }
  }
}
