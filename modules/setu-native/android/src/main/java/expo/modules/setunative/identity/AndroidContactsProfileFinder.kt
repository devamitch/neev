package expo.modules.setunative.identity

import android.content.Context
import android.provider.ContactsContract

internal object AndroidContactsProfileFinder {

    fun findUserProfile(context: Context): ContactIdentity? {
        return try {
            val projection = arrayOf(
                ContactsContract.Profile._ID,
                ContactsContract.Profile.DISPLAY_NAME_PRIMARY,
                ContactsContract.Profile.PHOTO_THUMBNAIL_URI
            )

            context.contentResolver.query(
                ContactsContract.Profile.CONTENT_URI,
                projection,
                null,
                null,
                null
            )?.use { cursor ->

                if (!cursor.moveToFirst()) return null

                val idIndex = cursor.getColumnIndex(ContactsContract.Profile._ID)
                if (idIndex < 0) return null

                val contactId = cursor.getLong(idIndex)

                val nameIndex = cursor.getColumnIndex(ContactsContract.Profile.DISPLAY_NAME_PRIMARY)
                val displayName = if (nameIndex >= 0) cursor.getString(nameIndex) else null

                val photoIndex = cursor.getColumnIndex(ContactsContract.Profile.PHOTO_THUMBNAIL_URI)
                val photoUri = if (photoIndex >= 0) cursor.getString(photoIndex) else null

                readContact(context, contactId, displayName, photoUri)
            }
        } catch (_: Exception) {
            null
        }
    }

    fun findUserProfileFromContactsTable(context: Context): ContactIdentity? {
        return try {
            val uri = ContactsContract.Contacts.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.Contacts._ID,
                ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                ContactsContract.Contacts.PHOTO_THUMBNAIL_URI,
                ContactsContract.Contacts.STARRED,
                ContactsContract.Contacts.HAS_PHONE_NUMBER
            )
            val sortOrder = "${ContactsContract.Contacts.STARRED} DESC, ${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY}"

            context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                sortOrder
            )?.use { cursor ->

                while (cursor.moveToNext()) {
                    val idIndex = cursor.getColumnIndex(ContactsContract.Contacts._ID)
                    val nameIndex = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)
                    val photoIndex = cursor.getColumnIndex(ContactsContract.Contacts.PHOTO_THUMBNAIL_URI)
                    val starredIndex = cursor.getColumnIndex(ContactsContract.Contacts.STARRED)
                    val hasPhoneIndex = cursor.getColumnIndex(ContactsContract.Contacts.HAS_PHONE_NUMBER)

                    if (idIndex < 0) continue

                    val contactId = cursor.getLong(idIndex)
                    val displayName = if (nameIndex >= 0) cursor.getString(nameIndex) else null
                    val photoUri = if (photoIndex >= 0) cursor.getString(photoIndex) else null
                    val isStarred = starredIndex >= 0 && cursor.getInt(starredIndex) == 1
                    val hasPhone = hasPhoneIndex >= 0 && cursor.getInt(hasPhoneIndex) == 1

                    if (isStarred && hasPhone && !displayName.isNullOrBlank()) {
                        val identity = readContact(context, contactId, displayName, photoUri)
                        if (identity != null) return identity
                    }
                }
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun readContact(
        context: Context,
        contactId: Long,
        displayName: String?,
        photoUri: String?
    ): ContactIdentity? {
        return AndroidContactsReader.readContact(context, contactId, displayName, photoUri)
    }
}