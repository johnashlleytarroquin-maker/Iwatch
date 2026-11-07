package com.iwatch.sos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Native Android 24/7 Foreground Service for on-duty responders.
 * Guarantees that emergency dispatches trigger siren alarm and vibration
 * even when the app is completely closed, killed from recents, or screen is locked.
 */
class ResponderAlertService : Service() {

    companion object {
        const val TAG = "ResponderAlertService"
        const val ACTION_START = "com.iwatch.sos.action.START_SERVICE"
        const val ACTION_STOP = "com.iwatch.sos.action.STOP_SERVICE"
        const val ACTION_SILENCE = "com.iwatch.sos.action.SILENCE_ALARM"

        const val CHANNEL_SERVICE_ID = "responder-active-service"
        const val CHANNEL_EMERGENCY_ID = "emergency-alerts"
        const val NOTIFICATION_SERVICE_ID = 9001
        const val NOTIFICATION_ALARM_ID = 9002

        @Volatile
        var isServiceRunning: Boolean = false
            private set
    }

    private var workerThread: Thread? = null
    @Volatile
    private var keepPolling = false
    private var token: String? = null
    private var serverUrl: String = "https://iwatch-api-qj2e.onrender.com"

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var lastAlertedReportId: Int = -1

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START

        when (action) {
            ACTION_STOP -> {
                Log.d(TAG, "Stopping responder service")
                stopAlarm()
                keepPolling = false
                isServiceRunning = false
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SILENCE -> {
                Log.d(TAG, "Silencing alarm")
                stopAlarm()
                return START_STICKY
            }
            ACTION_START -> {
                val newToken = intent?.getStringExtra("token")
                if (!newToken.isNullOrBlank()) {
                    token = newToken
                }
                val newUrl = intent?.getStringExtra("serverUrl")
                if (!newUrl.isNullOrBlank()) {
                    serverUrl = newUrl
                }

                // Show persistent on-duty foreground notification
                val notification = buildForegroundNotification()
                startForeground(NOTIFICATION_SERVICE_ID, notification)
                isServiceRunning = true

                if (workerThread == null || !workerThread!!.isAlive) {
                    keepPolling = true
                    startPollingThread()
                }
            }
        }

        return START_STICKY
    }

    private fun startPollingThread() {
        workerThread = thread(start = true, name = "IwatchResponderPoller") {
            Log.d(TAG, "Background responder dispatcher started polling")
            while (keepPolling) {
                try {
                    val currentAuthToken = token
                    if (!currentAuthToken.isNullOrBlank()) {
                        pollForActiveReports(currentAuthToken)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Polling check warning: ${e.message}")
                }

                try {
                    Thread.sleep(4000) // Poll every 4 seconds
                } catch (e: InterruptedException) {
                    break
                }
            }
            Log.d(TAG, "Background responder dispatcher stopped")
        }
    }

    private fun pollForActiveReports(authToken: String) {
        val url = URL("$serverUrl/api/reports?scope=all")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("Authorization", "Bearer $authToken")
            setRequestProperty("Accept", "application/json")
        }

        val code = conn.responseCode
        if (code == 200) {
            val reader = BufferedReader(InputStreamReader(conn.inputStream))
            val sb = StringBuilder()
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                sb.append(line)
            }
            reader.close()

            val json = JSONObject(sb.toString())
            val reports = json.optJSONArray("reports")
            if (reports != null && reports.length() > 0) {
                // Find any open report
                var openReport: JSONObject? = null
                for (i in 0 until reports.length()) {
                    val r = reports.getJSONObject(i)
                    if (r.optString("status") == "open") {
                        openReport = r
                        break
                    }
                }

                if (openReport != null) {
                    val reportId = openReport.optInt("id", -1)
                    if (reportId != -1 && reportId != lastAlertedReportId) {
                        lastAlertedReportId = reportId
                        val type = openReport.optString("type", "Emergency")
                        val studentName = openReport.optString("studentName", "Student")
                        val loc = openReport.optString("locationText", "Campus Location")
                        triggerEmergencyAlarm(reportId, type, studentName, loc)
                    }
                } else {
                    // No open reports right now; if alarm was sounding, silence it
                    if (lastAlertedReportId != -1) {
                        lastAlertedReportId = -1
                        stopAlarm()
                    }
                }
            }
        }
        conn.disconnect()
    }

    private fun triggerEmergencyAlarm(reportId: Int, type: String, studentName: String, location: String) {
        Log.i(TAG, "🚨 TRIGGERING CRITICAL RESPONDER ALARM for Case #$reportId")

        // 1. Wake up the phone screen immediately
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "Iwatch:EmergencyDispatchWakeLock"
            ).apply {
                acquire(45000) // Keep screen on for 45s
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not acquire wake lock: ${e.message}")
        }

        // 2. Play the emergency siren sound on continuous loop using USAGE_ALARM
        try {
            if (mediaPlayer == null) {
                mediaPlayer = MediaPlayer.create(this, R.raw.emergency_alarm)?.apply {
                    isLooping = true
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    start()
                }
            } else if (!mediaPlayer!!.isPlaying) {
                mediaPlayer?.start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing emergency alarm: ${e.message}")
        }

        // 3. Continuous urgent vibration
        try {
            val vib = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            vibrator = vib

            val pattern = longArrayOf(0, 600, 200, 600, 200, 1000, 400)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vib.vibrate(VibrationEffect.createWaveform(pattern, 0)) // 0 means repeat indefinitely
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error starting vibration: ${e.message}")
        }

        // 4. Show Heads-Up Alert Notification with FullScreenIntent
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("reportId", reportId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            reportId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Silence Action
        val silenceIntent = Intent(this, ResponderAlertService::class.java).apply {
            action = ACTION_SILENCE
        }
        val silencePendingIntent = PendingIntent.getService(
            this,
            1,
            silenceIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmNotification = NotificationCompat.Builder(this, CHANNEL_EMERGENCY_ID)
            .setContentTitle("🚨 CRITICAL SOS: ${type.uppercase()} EMERGENCY!")
            .setContentText("$studentName reported an emergency at $location")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .addAction(android.R.drawable.ic_lock_idle_alarm, "SILENCE ALARM", silencePendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "RESPOND NOW", pendingIntent)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ALARM_ID, alarmNotification)
    }

    private fun stopAlarm() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping media player: ${e.message}")
        }

        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping vibrator: ${e.message}")
        }

        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
            wakeLock = null
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing wake lock: ${e.message}")
        }

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIFICATION_ALARM_ID)
    }

    private fun buildForegroundNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_SERVICE_ID)
            .setContentTitle("🚨 Iwatch Responder Active")
            .setContentText("On duty • Monitoring campus emergencies 24/7")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Channel 1: Persistent Service Status (Low importance, quiet)
            val serviceChannel = NotificationChannel(
                CHANNEL_SERVICE_ID,
                "Responder On-Duty Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when a responder is on duty monitoring for emergency alerts"
                setShowBadge(false)
            }
            nm.createNotificationChannel(serviceChannel)

            // Channel 2: High Urgency Emergency Alarms
            val emergencyChannel = NotificationChannel(
                CHANNEL_EMERGENCY_ID,
                "Campus Emergency Dispatch Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Loud emergency siren alarms and heads-up dispatch notifications"
                setBypassDnd(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 600, 200, 600, 200, 1000, 300)
                setSound(
                    android.net.Uri.parse("android.resource://$packageName/${R.raw.emergency_alarm}"),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            }
            nm.createNotificationChannel(emergencyChannel)
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "ResponderAlertService onDestroy")
        stopAlarm()
        keepPolling = false
        isServiceRunning = false
        super.onDestroy()
    }
}
