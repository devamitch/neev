package expo.modules.setunative.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.graphics.drawable.IconCompat
import expo.modules.setunative.R
import expo.modules.setunative.messaging.EmergencyMessage
import expo.modules.setunative.ui.AvatarGenerator

internal object SetuNotificationManager {
    const val MESSAGES_CHANNEL = "setu_messages"
    const val TRANSFERS_CHANNEL = "setu_transfers"
    const val REQUESTS_CHANNEL = "setu_requests"
    const val EMERGENCY_CHANNEL = "setu_emergency"
    const val SERVICE_CHANNEL = "setu_service"

    const val ACTION_REPLY = "com.amit.setu.REPLY"
    const val ACTION_MARK_READ = "com.amit.setu.MARK_READ"
    const val ACTION_ACCEPT = "com.amit.setu.ACCEPT"
    const val ACTION_DECLINE = "com.amit.setu.DECLINE"

    private var lastTransferProgressUpdate = 0L

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = notificationManager(context)
        manager.createNotificationChannels(listOf(
            NotificationChannel(MESSAGES_CHANNEL, "Messages", NotificationManager.IMPORTANCE_HIGH),
            NotificationChannel(TRANSFERS_CHANNEL, "Transfers", NotificationManager.IMPORTANCE_LOW),
            NotificationChannel(REQUESTS_CHANNEL, "Requests", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(EMERGENCY_CHANNEL, "Emergency", NotificationManager.IMPORTANCE_HIGH),
            NotificationChannel(SERVICE_CHANNEL, "Setu service", NotificationManager.IMPORTANCE_MIN)
        ))
    }

    private fun createDeepLinkIntent(context: Context, path: String): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("setu://$path")).apply {
            setPackage(context.packageName)
        }
        return PendingIntent.getActivity(
            context,
            path.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createActionIntent(context: Context, action: String, id: String): PendingIntent {
        val intent = Intent(action).apply {
            setPackage(context.packageName)
            putExtra("id", id)
        }
        return PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
    }

    fun showMessage(
        context: Context,
        conversationId: String,
        senderId: String,
        content: String,
        timestamp: Long,
        senderName: String? = null
    ) {
        ensureChannels(context)
        val name = senderName ?: senderId.take(8)
        val avatar = AvatarGenerator.generate(senderId, 128, name)

        val person = Person.Builder()
            .setName(name)
            .setIcon(IconCompat.createWithBitmap(avatar))
            .build()

        val publicVersion = NotificationCompat.Builder(context, MESSAGES_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setContentTitle("Setu")
            .setContentText("New message")
            .build()

        val replyInput = RemoteInput.Builder("reply_text")
            .setLabel("Reply")
            .build()

        val replyAction = NotificationCompat.Action.Builder(
            R.drawable.ic_notif_reply,
            "Reply",
            createActionIntent(context, ACTION_REPLY, conversationId)
        ).addRemoteInput(replyInput).build()

        val markReadAction = NotificationCompat.Action.Builder(
            R.drawable.ic_notif_mark_read,
            "Mark as Read",
            createActionIntent(context, ACTION_MARK_READ, conversationId)
        ).build()

        val notification = NotificationCompat.Builder(context, MESSAGES_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            // MessagingStyle draws the sender's Person icon inline once a conversation has more
            // than one message, but the collapsed, single-message view - what every first message
            // actually shows - reads setLargeIcon instead. showFileReceived already set this;
            // showMessage never had, so a received file carried an avatar and a received message
            // did not.
            .setLargeIcon(avatar)
            .setStyle(NotificationCompat.MessagingStyle(Person.Builder().setName("Me").build())
                .addMessage(content, timestamp, person))
            .setContentIntent(
                createDeepLinkIntent(context, "messages?conversationId=${Uri.encode(conversationId)}")
            )
            .addAction(replyAction)
            .addAction(markReadAction)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build()

        notificationManager(context).notify(conversationId.hashCode(), notification)
    }

    fun showFileReceived(
        context: Context,
        senderId: String,
        fileName: String,
        fileType: String,
        senderName: String? = null,
        localFilePath: String? = null,
        contentId: String? = null
    ) {
        ensureChannels(context)
        val name = senderName ?: senderId.take(8)
        val avatar = AvatarGenerator.generate(senderId, 128, name)
        val contentIntent = createDeepLinkIntent(
            context,
            contentId?.let { "content?contentId=${Uri.encode(it)}" } ?: "content"
        )

        val publicVersion = NotificationCompat.Builder(context, TRANSFERS_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setContentTitle("Setu")
            .setContentText("New file received")
            .build()

        val builder = NotificationCompat.Builder(context, TRANSFERS_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setLargeIcon(avatar)
            .setContentTitle(name)
            .setContentText("Received $fileName ($fileType)")
            .setContentIntent(contentIntent)
            .addAction(
                NotificationCompat.Action.Builder(
                    R.drawable.ic_notif_open,
                    "Open",
                    contentIntent
                ).build()
            )
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setAutoCancel(true)
        if (fileType.startsWith("image/") && localFilePath != null) {
            NotificationImagePreview.decode(localFilePath)?.let { bitmap ->
                builder.setStyle(
                    NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap)
                        .setBigContentTitle(name)
                        .setSummaryText("Received image")
                )
            }
        }
        notificationManager(context).notify("file_${senderId}_$fileName".hashCode(), builder.build())
    }

    fun showRequest(
        context: Context,
        transferId: String,
        senderId: String,
        senderName: String,
        fileName: String
    ) {
        ensureChannels(context)
        // Seeded from the peer id, like showMessage/showFileReceived: a display name is not a
        // stable identity, and two different people can share one (a peer with no profile yet
        // read its own truncated id as its name, same as any other peer with no name on record).
        val avatar = AvatarGenerator.generate(senderId, 128, senderName)

        val acceptAction = NotificationCompat.Action.Builder(
            R.drawable.ic_notif_accept,
            "Accept",
            createActionIntent(context, ACTION_ACCEPT, transferId)
        ).build()

        val declineAction = NotificationCompat.Action.Builder(
            R.drawable.ic_notif_decline,
            "Decline",
            createActionIntent(context, ACTION_DECLINE, transferId)
        ).build()

        val publicVersion = NotificationCompat.Builder(context, REQUESTS_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setContentTitle("Setu")
            .setContentText("New transfer request")
            .build()

        val notification = NotificationCompat.Builder(context, REQUESTS_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setLargeIcon(avatar)
            .setContentTitle("Incoming transfer")
            .setContentText("$senderName wants to send $fileName")
            .addAction(acceptAction)
            .addAction(declineAction)
            .setContentIntent(createDeepLinkIntent(context, "transfers?transferId=${Uri.encode(transferId)}"))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setAutoCancel(true)
            .build()

        notificationManager(context).notify(transferId.hashCode(), notification)
    }

    fun updateTransferProgress(
        context: Context,
        transferId: String,
        peerName: String,
        verifiedBytes: Long,
        totalBytes: Long,
        isSending: Boolean,
        isComplete: Boolean = false
    ) {
        val now = SystemClock.elapsedRealtime()
        if (!isComplete && verifiedBytes < totalBytes && now - lastTransferProgressUpdate < 1000) {
            return // Throttle to <=1/s unless complete
        }
        lastTransferProgressUpdate = now

        ensureChannels(context)
        val title = if (isSending) "Sending to $peerName" else "Receiving from $peerName"
        val percent = if (totalBytes > 0) {
            ((verifiedBytes.coerceAtLeast(0).toDouble() / totalBytes.toDouble()) * 100).toInt().coerceIn(0, 100)
        } else {
            0
        }
        val progressText = when {
            isComplete || (totalBytes > 0 && verifiedBytes >= totalBytes) -> "Done"
            totalBytes > 0 -> "$percent%"
            else -> "Preparing..."
        }
        val publicVersion = NotificationCompat.Builder(context, TRANSFERS_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setContentTitle("Setu")
            .setContentText("Transfer in progress")
            .build()
        val builder = NotificationCompat.Builder(context, TRANSFERS_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setContentTitle(title)
            .setContentIntent(
                createDeepLinkIntent(context, "transfer/${Uri.encode(transferId)}")
            )
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setOnlyAlertOnce(true)
            .setOngoing(!isComplete && (totalBytes <= 0 || verifiedBytes < totalBytes))

        if (totalBytes > 0) {
            builder.setProgress(100, percent, false)
            builder.setContentText("$percent%")
        } else {
            builder.setProgress(0, 0, true)
            builder.setContentText("Preparing...")
        }

        if (isComplete || (verifiedBytes >= totalBytes && totalBytes > 0)) {
            builder.setContentText("Done")
            builder.setProgress(0, 0, false)
            builder.setOngoing(false)
        }

        notificationManager(context).notify(transferId.hashCode(), builder.build())
    }

    fun showEmergency(context: Context, message: EmergencyMessage) {
        ensureChannels(context)
        val publicVersion = NotificationCompat.Builder(context, EMERGENCY_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setContentTitle("Setu")
            .setContentText("Emergency broadcast")
            .build()

        val notification = NotificationCompat.Builder(context, EMERGENCY_CHANNEL)
            .setSmallIcon(R.drawable.ic_setu_notification)
            .setContentTitle("Emergency broadcast")
            .setContentText("Not end-to-end encrypted: ${message.content}")
            .setContentIntent(createDeepLinkIntent(context, "emergency"))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .build()

        notificationManager(context).notify(message.broadcastId.hashCode(), notification)
    }

    private fun notificationManager(context: Context): NotificationManager =
        context.getSystemService(NotificationManager::class.java)
            ?: error("NOTIFICATION_MANAGER_UNAVAILABLE")
}
