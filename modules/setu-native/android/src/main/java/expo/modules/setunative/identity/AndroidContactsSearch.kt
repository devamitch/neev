package expo.modules.setunative.identity

import android.content.Context
import android.provider.ContactsContract

internal object AndroidContactsSearch {

    fun findByPhone(context: Context, phoneNumber: String?): ContactIdentity? {
        if (phoneNumber.isNullOrBlank()) return null

        return try {
            val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.PHOTO_THUMBNAIL_URI
            )
            val selection = "${ContactsContract.CommonDataKinds.Phone.NUMBER} = ?"
            val selectionArgs = arrayOf(phoneNumber)

            context.contentResolver.query(
                uri,
                projection,
                selection,
                selectionArgs,
                null
            )?.use { cursor ->

                if (cursor.moveToFirst()) {
                    val idIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY)
                    val photoIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.PHOTO_THUMBNAIL_URI)

                    if (idIndex >= 0) {
                        val contactId = cursor.getLong(idIndex)
                        val displayName = if (nameIndex >= 0) cursor.getString(nameIndex) else null
                        val photoUri = if (photoIndex >= 0) cursor.getString(photoIndex) else null
                        return AndroidContactsReader.readContact(context, contactId, displayName, photoUri)
                    }
                }
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    fun findByEmail(context: Context, email: String?): ContactIdentity? {
        if (email.isNullOrBlank()) return null

        return try {
            val uri = ContactsContract.CommonDataKinds.Email.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Email.CONTACT_ID,
                ContactsContract.CommonDataKinds.Email.DISPLAY_NAME_PRIMARY,
                ContactsContract.CommonDataKinds.Email.DATA,
                ContactsContract.CommonDataKinds.Email.PHOTO_THUMBNAIL_URI
            )
            val selection = "${ContactsContract.CommonDataKinds.Email.DATA} = ?"
            val selectionArgs = arrayOf(email)

            context.contentResolver.query(
                uri,
                projection,
                selection,
                selectionArgs,
                null
            )?.use { cursor ->

                if (cursor.moveToFirst()) {
                    val idIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.CONTACT_ID)
                    val nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.DISPLAY_NAME_PRIMARY)
                    val photoIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.PHOTO_THUMBNAIL_URI)

                    if (idIndex >= 0) {
                        val contactId = cursor.getLong(idIndex)
                        val displayName = if (nameIndex >= 0) cursor.getString(nameIndex) else null
                        val photoUri = if (photoIndex >= 0) cursor.getString(photoIndex) else null
                        return AndroidContactsReader.readContact(context, contactId, displayName, photoUri)
                    }
                }
                null
            }
        } catch (_: Exception) {
            null
        }
    }
}