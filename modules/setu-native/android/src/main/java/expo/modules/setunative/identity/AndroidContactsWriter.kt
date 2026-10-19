package expo.modules.setunative.identity

import android.content.ContentProviderOperation
import android.content.Context
import android.provider.ContactsContract
import expo.modules.setunative.shared.SetuLog

/**
 * Writes a contact for someone the user has paired with. Everything Setu creates goes into its own
 * local account type, so these rows never sync to Google and are easy to tell apart from the
 * user's own contacts.
 */
internal object AndroidContactsWriter {

    /** The account Setu's own rows live under. A null name means "device only", never synced. */
    private const val ACCOUNT_TYPE = "expo.modules.setunative.peer"

    /**
     * Creates or updates the contact for a paired peer and returns its raw contact id.
     * An existing Setu contact with the same peer id is updated rather than duplicated.
     */
    fun savePeerContact(
        context: Context,
        peerId: String,
        displayName: String,
        phoneNumber: String?,
        email: String?,
        note: String?,
    ): Long? {
        require(peerId.isNotBlank()) { "PEER_ID_REQUIRED" }
        require(displayName.isNotBlank()) { "DISPLAY_NAME_REQUIRED" }

        return try {
            removePeerContact(context, peerId)

            val ops = arrayListOf<ContentProviderOperation>()
            ops.add(
                ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, ACCOUNT_TYPE)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
                    // The peer id is the join key: it is how an update finds this row again.
                    .withValue(ContactsContract.RawContacts.SOURCE_ID, peerId)
                    .build()
            )
            ops.add(dataRow(ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, displayName)
                .build())
            if (!phoneNumber.isNullOrBlank()) {
                ops.add(dataRow(ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phoneNumber)
                    .withValue(
                        ContactsContract.CommonDataKinds.Phone.TYPE,
                        ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE
                    )
                    .build())
            }
            if (!email.isNullOrBlank()) {
                ops.add(dataRow(ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Email.ADDRESS, email)
                    .withValue(
                        ContactsContract.CommonDataKinds.Email.TYPE,
                        ContactsContract.CommonDataKinds.Email.TYPE_OTHER
                    )
                    .build())
            }
            if (!note.isNullOrBlank()) {
                ops.add(dataRow(ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Note.NOTE, note)
                    .build())
            }

            val results = context.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
            val id = results.firstOrNull()?.uri?.lastPathSegment?.toLongOrNull()
            SetuLog.i(SetuLog.IDENTITY, "peer contact saved id=${SetuLog.id(peerId)}")
            id
        } catch (error: Exception) {
            SetuLog.w(SetuLog.IDENTITY, "peer contact save failed: ${error.javaClass.simpleName}")
            null
        }
    }

    /** Removes the contact Setu created for this peer. Contacts the user made are never touched. */
    fun removePeerContact(context: Context, peerId: String): Boolean = try {
        val deleted = context.contentResolver.delete(
            ContactsContract.RawContacts.CONTENT_URI,
            "${ContactsContract.RawContacts.ACCOUNT_TYPE} = ? AND ${ContactsContract.RawContacts.SOURCE_ID} = ?",
            arrayOf(ACCOUNT_TYPE, peerId)
        )
        deleted > 0
    } catch (error: Exception) {
        SetuLog.w(SetuLog.IDENTITY, "peer contact delete failed: ${error.javaClass.simpleName}")
        false
    }

    /** True when Setu already has a contact row for this peer. */
    fun hasPeerContact(context: Context, peerId: String): Boolean = try {
        context.contentResolver.query(
            ContactsContract.RawContacts.CONTENT_URI,
            arrayOf(ContactsContract.RawContacts._ID),
            "${ContactsContract.RawContacts.ACCOUNT_TYPE} = ? AND ${ContactsContract.RawContacts.SOURCE_ID} = ? AND ${ContactsContract.RawContacts.DELETED} = 0",
            arrayOf(ACCOUNT_TYPE, peerId),
            null
        )?.use { it.moveToFirst() } ?: false
    } catch (error: Exception) {
        SetuLog.w(SetuLog.IDENTITY, "peer contact lookup failed: ${error.javaClass.simpleName}")
        false
    }

    /** A data row attached to the raw contact the batch is about to insert (back reference 0). */
    private fun dataRow(mimeType: String): ContentProviderOperation.Builder =
        ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
            .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
            .withValue(ContactsContract.Data.MIMETYPE, mimeType)
}
