package expo.modules.setunative.identity

import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.util.Log

internal object AndroidContactsReader {
    private const val TAG = "SETU_IDENTITY"

    fun readContactUri(context: Context, uri: Uri): ContactIdentity? {
        return try {
            val contactId = uri.lastPathSegment?.toLongOrNull() ?: return null
            var displayName: String? = null
            var photoUri: String? = null

            val contactUri = ContactsContract.Contacts.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                ContactsContract.Contacts.PHOTO_THUMBNAIL_URI
            )
            val selection = "${ContactsContract.Contacts._ID} = ?"
            val selectionArgs = arrayOf(contactId.toString())

            context.contentResolver.query(
                contactUri,
                projection,
                selection,
                selectionArgs,
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)
                    displayName = if (nameIndex >= 0) cursor.getString(nameIndex) else null
                    val photoIndex = cursor.getColumnIndex(ContactsContract.Contacts.PHOTO_THUMBNAIL_URI)
                    photoUri = if (photoIndex >= 0) cursor.getString(photoIndex) else null
                }
            }

            readContact(context, contactId, displayName, photoUri)
        } catch (_: Exception) {
            Log.w(TAG, "Unable to read selected contact")
            null
        }
    }

    fun readContact(
        context: Context,
        contactId: Long,
        displayName: String?,
        photoUri: String?
    ): ContactIdentity? {
        val identity = ContactIdentity(displayName = displayName, photoUri = photoUri)
        readPhoneNumbers(context, contactId, identity)
        readEmails(context, contactId, identity)
        readOrganizationInfo(context, contactId, identity)
        readStructuredName(context, contactId, identity)
        return identity
    }

    private fun readPhoneNumbers(context: Context, contactId: Long, identity: ContactIdentity) {
        try {
            val phoneUri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
            val phoneProjection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.TYPE
            )
            val selection = "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?"
            context.contentResolver.query(
                phoneUri, phoneProjection, selection, arrayOf(contactId.toString()), null
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val typeIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.TYPE)
                    if (numberIndex >= 0) {
                        val number = cursor.getString(numberIndex)
                        val type = if (typeIndex >= 0) cursor.getInt(typeIndex) else 0
                        processPhoneNumber(identity, number, type)
                    }
                }
            }
        } catch (_: Exception) {
            Log.w(TAG, "Unable to read contact phone numbers")
        }
    }

    private fun readEmails(context: Context, contactId: Long, identity: ContactIdentity) {
        try {
            val emailUri = ContactsContract.CommonDataKinds.Email.CONTENT_URI
            val projection = arrayOf(ContactsContract.CommonDataKinds.Email.DATA)
            val selection = "${ContactsContract.CommonDataKinds.Email.CONTACT_ID} = ?"
            context.contentResolver.query(
                emailUri, projection, selection, arrayOf(contactId.toString()), null
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val emailIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.DATA)
                    if (emailIndex >= 0) {
                        val email = cursor.getString(emailIndex)
                        identity.emails = identity.emails + email
                    }
                }
            }
        } catch (_: Exception) {
            Log.w(TAG, "Unable to read contact email addresses")
        }
    }

    private fun readOrganizationInfo(context: Context, contactId: Long, identity: ContactIdentity) {
        try {
            val orgUri = ContactsContract.Data.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Organization.DATA,
                ContactsContract.CommonDataKinds.Organization.TITLE,
                ContactsContract.CommonDataKinds.Organization.DEPARTMENT
            )
            val selection = "${ContactsContract.Data.MIMETYPE} = ? AND ${ContactsContract.Data.CONTACT_ID} = ?"
            context.contentResolver.query(
                orgUri,
                projection,
                selection,
                arrayOf(ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE, contactId.toString()),
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    identity.organization = cursor.getStringOrNull(ContactsContract.CommonDataKinds.Organization.DATA)
                    identity.jobTitle = cursor.getStringOrNull(ContactsContract.CommonDataKinds.Organization.TITLE)
                    identity.department = cursor.getStringOrNull(ContactsContract.CommonDataKinds.Organization.DEPARTMENT)
                }
            }
        } catch (_: Exception) {
            Log.w(TAG, "Unable to read contact organization")
        }
    }

    private fun readStructuredName(context: Context, contactId: Long, identity: ContactIdentity) {
        try {
            val nameUri = ContactsContract.Data.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME,
                ContactsContract.CommonDataKinds.StructuredName.MIDDLE_NAME,
                ContactsContract.CommonDataKinds.StructuredName.FAMILY_NAME,
                ContactsContract.CommonDataKinds.StructuredName.PREFIX,
                ContactsContract.CommonDataKinds.StructuredName.SUFFIX
            )
            val selection = "${ContactsContract.Data.MIMETYPE} = ? AND ${ContactsContract.Data.CONTACT_ID} = ?"
            context.contentResolver.query(
                nameUri,
                projection,
                selection,
                arrayOf(ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE, contactId.toString()),
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    identity.givenName = cursor.getStringOrNull(ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME)
                    identity.middleName = cursor.getStringOrNull(ContactsContract.CommonDataKinds.StructuredName.MIDDLE_NAME)
                    identity.familyName = cursor.getStringOrNull(ContactsContract.CommonDataKinds.StructuredName.FAMILY_NAME)
                    identity.namePrefix = cursor.getStringOrNull(ContactsContract.CommonDataKinds.StructuredName.PREFIX)
                    identity.nameSuffix = cursor.getStringOrNull(ContactsContract.CommonDataKinds.StructuredName.SUFFIX)
                    updateDisplayNameIfNeeded(identity)
                }
            }
        } catch (_: Exception) {
            Log.w(TAG, "Unable to read contact name components")
        }
    }

    private fun Cursor.getStringOrNull(columnName: String): String? {
        val index = getColumnIndex(columnName)
        return if (index >= 0 && !isNull(index)) getString(index) else null
    }

    private fun processPhoneNumber(identity: ContactIdentity, number: String, type: Int) {
        when (type) {
            ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE -> {
                identity.phoneNumbers = listOf(number) + identity.phoneNumbers
            }
            else -> identity.phoneNumbers = identity.phoneNumbers + number
        }
    }

    private fun updateDisplayNameIfNeeded(identity: ContactIdentity) {
        if (identity.displayName.isNullOrBlank() && (identity.givenName != null || identity.familyName != null)) {
            identity.displayName = listOfNotNull(
                identity.namePrefix, identity.givenName, identity.middleName,
                identity.familyName, identity.nameSuffix
            ).joinToString(" ")
        }
    }
}
