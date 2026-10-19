package expo.modules.setunative.persistence

import expo.modules.setunative.messaging.Conversation
import expo.modules.setunative.messaging.SetuMessage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream

/** Bounded serialization for message metadata encrypted by SetuStore. */
internal object MessageRecordCodec {
    fun encodeMessage(message: SetuMessage): ByteArray = encode { output ->
        output.writeInt(MAGIC)
        output.writeByte(MESSAGE_KIND)
        output.writeString(message.messageId)
        output.writeString(message.conversationId)
        output.writeString(message.senderId)
        output.writeString(message.recipientId)
        output.writeString(message.content)
        output.writeString(message.type)
        output.writeString(message.state)
        output.writeLong(message.timestamp)
        output.writeBoolean(message.isEncrypted)
        output.writeBoolean(message.isRead)
        output.writeStringList(message.attachmentIds)
        output.writeInt(message.hopCount)
        output.writeLong(message.expiresAt)
    }

    fun decodeMessage(bytes: ByteArray): SetuMessage = decode(bytes, MESSAGE_KIND) { input ->
        SetuMessage(
            messageId = input.readString(),
            conversationId = input.readString(),
            senderId = input.readString(),
            recipientId = input.readString(),
            content = input.readString(),
            type = input.readString(),
            state = input.readString(),
            timestamp = input.readLong(),
            isEncrypted = input.readBoolean(),
            isRead = input.readBoolean(),
            attachmentIds = input.readStringList(),
            hopCount = input.readInt().also { require(it >= 0) },
            expiresAt = input.readLong()
        )
    }

    fun encodeConversation(conversation: Conversation): ByteArray = encode { output ->
        output.writeInt(MAGIC)
        output.writeByte(CONVERSATION_KIND)
        output.writeString(conversation.conversationId)
        output.writeStringList(conversation.participants.sorted())
        output.writeLong(conversation.createdAt)
        output.writeLong(conversation.lastMessageAt)
        output.writeNullableString(conversation.lastMessageContent)
        output.writeBoolean(conversation.isGroup)
        output.writeNullableString(conversation.name)
        output.writeNullableString(conversation.ownerId)
    }

    fun decodeConversation(bytes: ByteArray): Conversation = decode(bytes, CONVERSATION_KIND) { input ->
        Conversation(
            conversationId = input.readString(),
            participants = input.readStringList()?.toSet() ?: emptySet(),
            createdAt = input.readLong(),
            lastMessageAt = input.readLong(),
            lastMessageContent = input.readNullableString(),
            isGroup = input.readBoolean(),
            name = input.readNullableString(),
            ownerId = input.readNullableString()
        )
    }

    private fun encode(write: (DataOutputStream) -> Unit): ByteArray {
        val buffer = ByteArrayOutputStream()
        DataOutputStream(buffer).use(write)
        return buffer.toByteArray().also { require(it.size <= MAX_RECORD_BYTES) }
    }

    private fun <T> decode(bytes: ByteArray, kind: Int, read: (DataInputStream) -> T): T {
        require(bytes.size in 6..MAX_RECORD_BYTES) { "Invalid message record size" }
        val input = DataInputStream(ByteArrayInputStream(bytes))
        require(input.readInt() == MAGIC && input.readUnsignedByte() == kind) {
            "Unsupported message record format"
        }
        return read(input).also { require(input.available() == 0) { "Trailing message record data" } }
    }

    private fun DataOutputStream.writeString(value: String) {
        val encoded = value.toByteArray(Charsets.UTF_8)
        require(encoded.size <= MAX_STRING_BYTES) { "Message field exceeds its size limit" }
        writeInt(encoded.size)
        write(encoded)
        encoded.fill(0)
    }

    private fun DataInputStream.readString(): String {
        val length = readInt()
        require(length in 0..MAX_STRING_BYTES && length <= available()) { "Invalid message field length" }
        return ByteArray(length).also(::readFully).toString(Charsets.UTF_8)
    }

    private fun DataOutputStream.writeNullableString(value: String?) {
        writeBoolean(value != null)
        if (value != null) writeString(value)
    }

    private fun DataInputStream.readNullableString(): String? = if (readBoolean()) readString() else null

    private fun DataOutputStream.writeStringList(values: List<String>?) {
        if (values == null) {
            writeInt(-1)
            return
        }
        require(values.size <= MAX_LIST_ITEMS) { "Too many message fields" }
        writeInt(values.size)
        values.forEach { value -> writeString(value) }
    }

    private fun DataInputStream.readStringList(): List<String>? {
        val count = readInt()
        if (count == -1) return null
        require(count in 0..MAX_LIST_ITEMS) { "Invalid message field count" }
        return List(count) { readString() }
    }

    private const val MAGIC = 0x534D5347
    private const val MESSAGE_KIND = 1
    private const val CONVERSATION_KIND = 2
    private const val MAX_STRING_BYTES = 1024 * 1024
    private const val MAX_RECORD_BYTES = 2 * 1024 * 1024
    private const val MAX_LIST_ITEMS = 256
}
