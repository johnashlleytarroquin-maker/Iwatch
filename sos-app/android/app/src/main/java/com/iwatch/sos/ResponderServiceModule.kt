package com.iwatch.sos

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ResponderServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ResponderAlertModule"

    @ReactMethod
    fun startService(token: String, serverUrl: String?, promise: Promise) {
        try {
            val intent = Intent(reactContext, ResponderAlertService::class.java).apply {
                action = ResponderAlertService.ACTION_START
                putExtra("token", token)
                if (!serverUrl.isNullOrBlank()) {
                    putExtra("serverUrl", serverUrl)
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(reactContext, intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactContext, ResponderAlertService::class.java).apply {
                action = ResponderAlertService.ACTION_STOP
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun silenceAlarm(promise: Promise) {
        try {
            val intent = Intent(reactContext, ResponderAlertService::class.java).apply {
                action = ResponderAlertService.ACTION_SILENCE
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SILENCE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(ResponderAlertService.isServiceRunning)
    }
}
