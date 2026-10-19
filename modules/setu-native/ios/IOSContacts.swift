import Contacts
import Foundation

enum IOSContacts {

  static let keys: [CNKeyDescriptor] = [
    CNContactGivenNameKey as CNKeyDescriptor,
    CNContactMiddleNameKey as CNKeyDescriptor,
    CNContactFamilyNameKey as CNKeyDescriptor,
    CNContactNicknameKey as CNKeyDescriptor,
    CNContactOrganizationNameKey as CNKeyDescriptor,
    CNContactDepartmentNameKey as CNKeyDescriptor,
    CNContactJobTitleKey as CNKeyDescriptor,
    CNContactPhoneNumbersKey as CNKeyDescriptor,
    CNContactEmailAddressesKey as CNKeyDescriptor,
    CNContactThumbnailImageDataKey as CNKeyDescriptor
  ]

  static func requestAccess() async -> Bool {
    let status = CNContactStore.authorizationStatus(
      for: .contacts
    )

    if status == .authorized {
      return true
    }

    if #available(iOS 18.0, *), status == .limited {
      return true
    }

    guard status == .notDetermined else {
      return false
    }

    do {
      let granted = try await CNContactStore()
        .requestAccess(for: .contacts)

      if granted {
        return true
      }

      if #available(iOS 18.0, *),
        CNContactStore.authorizationStatus(for: .contacts) == .limited {
        return true
      }

      return false
    } catch {
      return false
    }
  }

  static func meCard() throws -> SetuContactIdentity? {
    guard let contact = try CNContactStore()
      .unifiedMeContact(withKeysToFetch: keys) else {
      return nil
    }

    return convert(contact)
  }

  static func convert(
    _ contact: CNContact
  ) -> SetuContactIdentity {
    let phones = contact.phoneNumbers.map {
      $0.value.stringValue
    }

    let emails = contact.emailAddresses.map {
      $0.value as String
    }

    let name = [
      contact.givenName,
      contact.middleName,
      contact.familyName
    ]
      .filter { !$0.isEmpty }
      .joined(separator: " ")

    let photo: String?
    if let data = contact.thumbnailImageData,
       !data.isEmpty {
      photo =
        "data:image/jpeg;base64," +
        data.base64EncodedString()
    } else {
      photo = nil
    }

    return SetuContactIdentity(
      displayName: name.isEmpty ? nil : name,
      givenName: contact.givenName.isEmpty
        ? nil : contact.givenName,
      middleName: contact.middleName.isEmpty
        ? nil : contact.middleName,
      familyName: contact.familyName.isEmpty
        ? nil : contact.familyName,
      phoneNumbers: phones,
      emails: emails,
      organization: contact.organizationName.isEmpty
        ? nil : contact.organizationName,
      department: contact.departmentName.isEmpty
        ? nil : contact.departmentName,
      jobTitle: contact.jobTitle.isEmpty
        ? nil : contact.jobTitle,
      nickname: contact.nickname.isEmpty
        ? nil : contact.nickname,
      photoUri: photo
    )
  }
}

struct SetuContactIdentity {
  var displayName: String?
  var givenName: String?
  var middleName: String?
  var familyName: String?
  var phoneNumbers: [String]
  var emails: [String]
  var organization: String?
  var department: String?
  var jobTitle: String?
  var nickname: String?
  var photoUri: String?

  var phoneNumber: String? {
    phoneNumbers.first
  }

  var email: String? {
    emails.first
  }

  static let empty = SetuContactIdentity(
    displayName: nil,
    givenName: nil,
    middleName: nil,
    familyName: nil,
    phoneNumbers: [],
    emails: [],
    organization: nil,
    department: nil,
    jobTitle: nil,
    nickname: nil,
    photoUri: nil
  )
}
