package expo.modules.setunative.identity

enum class ProfileVisibility {
    PUBLIC,
    CONTACTS_ONLY,
    TRUSTED_ONLY,
    PRIVATE
}

data class SetuProfile(
    val deviceId: String,
    val displayName: String,
    val phone: String? = null,
    val email: String? = null,
    val photoUri: String? = null,
    val visibility: ProfileVisibility = ProfileVisibility.CONTACTS_ONLY,
    val version: Long = 0
)

/**
 * One person as the device's contact store knows them. Setu reads this for two things only: the
 * owner's own card, to prefill onboarding, and a lookup of a peer the user has paired with.
 */
data class ContactIdentity(
    var displayName: String? = null,
    var givenName: String? = null,
    var middleName: String? = null,
    var familyName: String? = null,
    var phoneNumbers: List<String> = emptyList(),
    var emails: List<String> = emptyList(),
    var organization: String? = null,
    var department: String? = null,
    var jobTitle: String? = null,
    var nickname: String? = null,
    var photoUri: String? = null,
    var namePrefix: String? = null,
    var nameSuffix: String? = null,
) {
    val phoneNumber: String?
        get() = phoneNumbers.firstOrNull()

    val email: String?
        get() = emails.firstOrNull()

    fun toMap(): Map<String, Any?> = mapOf(
        "displayName" to displayName,
        "givenName" to givenName,
        "middleName" to middleName,
        "familyName" to familyName,
        "phoneNumbers" to phoneNumbers,
        "emails" to emails,
        "organization" to organization,
        "department" to department,
        "jobTitle" to jobTitle,
        "nickname" to nickname,
        "photoUri" to photoUri,
        "namePrefix" to namePrefix,
        "nameSuffix" to nameSuffix,
    )
}
