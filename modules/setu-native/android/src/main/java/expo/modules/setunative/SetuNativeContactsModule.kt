package expo.modules.setunative

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.identity.AndroidContacts
import expo.modules.setunative.identity.AndroidContactsWriter

/**
 * The device's contact store, for exactly two purposes:
 *
 *  - reading the owner's own card, so onboarding can offer their real name and email instead of an
 *    empty field;
 *  - writing a contact for someone the user has paired with, under Setu's own local account so the
 *    row never syncs and is never confused with a contact the user made.
 *
 * Nothing is read or written without the matching runtime permission, and no contact list is ever
 * enumerated or sent anywhere.
 */
class SetuNativeContactsModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("SetuNativeContacts")

        Function("getPermissions") { permissions() }

        AsyncFunction("getOwnerProfile") { ownerProfile() }

        AsyncFunction("findByPhone") { phoneNumber: String ->
            if (!canRead()) throw SecurityException("CONTACTS_READ_DENIED")
            AndroidContacts.findByPhone(context(), phoneNumber)?.toMap()
        }

        AsyncFunction("findByEmail") { email: String ->
            if (!canRead()) throw SecurityException("CONTACTS_READ_DENIED")
            AndroidContacts.findByEmail(context(), email)?.toMap()
        }

        AsyncFunction("savePeerContact") { peerId: String,
            displayName: String,
            phoneNumber: String?,
            email: String?,
            note: String? ->
            if (!canWrite()) throw SecurityException("CONTACTS_WRITE_DENIED")
            AndroidContactsWriter.savePeerContact(
                context(), peerId, displayName, phoneNumber, email, note
            )?.toString()
        }

        AsyncFunction("removePeerContact") { peerId: String ->
            if (!canWrite()) throw SecurityException("CONTACTS_WRITE_DENIED")
            AndroidContactsWriter.removePeerContact(context(), peerId)
        }

        AsyncFunction("hasPeerContact") { peerId: String ->
            if (!canRead()) false else AndroidContactsWriter.hasPeerContact(context(), peerId)
        }
    }

    private fun context(): Context = appContext.reactContext
        ?: throw IllegalStateException("REACT_CONTEXT_UNAVAILABLE")

    private fun granted(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context(), permission) == PackageManager.PERMISSION_GRANTED

    private fun canRead(): Boolean = granted(Manifest.permission.READ_CONTACTS)

    private fun canWrite(): Boolean = granted(Manifest.permission.WRITE_CONTACTS)

    private fun permissions(): Map<String, Boolean> =
        mapOf("read" to canRead(), "write" to canWrite())

    /**
     * The owner's own contact card. Android exposes it as the Profile table; some devices leave it
     * empty, in which case the contacts table's own "me" row is the fallback.
     */
    private fun ownerProfile(): Map<String, Any?>? {
        if (!canRead()) throw SecurityException("CONTACTS_READ_DENIED")
        val ctx = context()
        val profile = AndroidContacts.findUserProfile(ctx)
            ?: AndroidContacts.findUserProfileFromContactsTable(ctx)
        return profile?.toMap()
    }
}
