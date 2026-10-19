package expo.modules.setunative.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.core.app.RemoteInput
import expo.modules.setunative.SetuNativeModule

internal class SetuNotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            SetuNotificationManager.ACTION_REPLY -> {
                val id = intent.getStringExtra("id") ?: return
                val results: Bundle = RemoteInput.getResultsFromIntent(intent) ?: return
                val replyText = results.getCharSequence("reply_text")?.toString()
                SetuNativeModule.onNotificationReply(id, replyText)
            }
            SetuNotificationManager.ACTION_MARK_READ -> {
                val id = intent.getStringExtra("id") ?: return
                SetuNativeModule.onNotificationMarkRead(id)
            }
            SetuNotificationManager.ACTION_ACCEPT -> {
                val id = intent.getStringExtra("id") ?: return
                SetuNativeModule.onNotificationAcceptRequest(id)
            }
            SetuNotificationManager.ACTION_DECLINE -> {
                val id = intent.getStringExtra("id") ?: return
                SetuNativeModule.onNotificationDeclineRequest(id)
            }
        }
    }
}
