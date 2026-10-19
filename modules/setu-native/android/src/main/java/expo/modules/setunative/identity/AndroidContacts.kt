package expo.modules.setunative.identity

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract

object AndroidContacts {

    fun findUserProfile(context: Context): ContactIdentity? {
        return AndroidContactsProfileFinder.findUserProfile(context)
    }

    fun findUserProfileFromContactsTable(context: Context): ContactIdentity? {
        return AndroidContactsProfileFinder.findUserProfileFromContactsTable(context)
    }

    fun findByPhone(context: Context, phoneNumber: String?): ContactIdentity? {
        return AndroidContactsSearch.findByPhone(context, phoneNumber)
    }

    fun findByEmail(context: Context, email: String?): ContactIdentity? {
        return AndroidContactsSearch.findByEmail(context, email)
    }

    fun findByPhoneNumber(context: Context, phoneNumber: String?): ContactIdentity? {
        return AndroidContactsSearch.findByPhone(context, phoneNumber)
    }

    fun readContactUri(context: Context, uri: Uri): ContactIdentity? {
        return AndroidContactsReader.readContactUri(context, uri)
    }
}