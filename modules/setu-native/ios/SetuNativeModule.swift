import Contacts
import ContactsUI
import ExpoModulesCore
import Foundation
import UIKit

public final class SetuNativeModule: Module {

  private let keyStore = SetuKeyStore()
  private let picker = IOSContactPickerCoordinator()

  public func definition() -> ModuleDefinition {
    Name("SetuNative")

    Function("ping") {
      "Setu native iOS bridge is alive"
    }

    AsyncFunction("getUserIdentity") {
      try await self.resolveIdentity()
    }

    AsyncFunction("pickOwnContact") {
      (promise: Promise) in

      guard let vc =
        self.appContext?.utilities?.currentViewController()
      else {
        promise.reject(
          "NO_VIEW_CONTROLLER",
          "Unable to present contact picker"
        )
        return
      }

      self.picker.present(
        from: vc
      ) { result in
        switch result {
        case .success(let person):
          do {
            promise.resolve(
              try self.identityMap(
                person: person,
                source: "ios_contact_picker",
                confidence: "user_selected",
                contactsPermission: false,
                meCardFound: false,
                pickerUsed: true,
                errors: []
              )
            )
          } catch {
            promise.reject(
              "IDENTITY_BUILD_FAILED",
              error.localizedDescription
            )
          }

        case .failure(let error):
          promise.reject(
            "CONTACT_PICKER_CANCELLED",
            error.localizedDescription
          )
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("pickPhoneNumberHint") {
      (promise: Promise) in
      promise.reject(
        "UNSUPPORTED_PLATFORM",
        "Phone Number Hint is Android-only"
      )
    }

    AsyncFunction("pickAccount") {
      (promise: Promise) in
      promise.reject(
        "UNSUPPORTED_PLATFORM",
        "Android AccountManager is not available on iOS"
      )
    }

    AsyncFunction("isTruecallerAvailable") {
      false
    }
  }

  private func resolveIdentity() async throws
    -> [String: Any] {

    let access = await IOSContacts.requestAccess()
    var person: SetuContactIdentity?
    var errors: [String] = []

    if access {
      do {
        person = try IOSContacts.meCard()
      } catch {
        errors.append(
          "iOS My Card: \(error.localizedDescription)"
        )
      }
    } else {
      errors.append(
        "Contacts permission not granted"
      )
    }

    let found = person != nil

    return try identityMap(
      person: person ?? .empty,
      source: found ? "ios_me_card" : "device_only",
      confidence: found ? "os_provided" : "device_only",
      contactsPermission: access,
      meCardFound: found,
      pickerUsed: false,
      errors: errors
    )
  }

  private func identityMap(
    person: SetuContactIdentity,
    source: String,
    confidence: String,
    contactsPermission: Bool,
    meCardFound: Bool,
    pickerUsed: Bool,
    errors: [String]
  ) throws -> [String: Any] {

    let crypto =
      try keyStore.getOrCreateIdentity()

    let device = UIDevice.current

    return [
      "person": [
        "displayName": person.displayName as Any,
        "givenName": person.givenName as Any,
        "middleName": person.middleName as Any,
        "familyName": person.familyName as Any,
        "phoneNumber": person.phoneNumber as Any,
        "phoneNumbers": person.phoneNumbers,
        "email": person.email as Any,
        "emails": person.emails,
        "organization": person.organization as Any,
        "department": person.department as Any,
        "jobTitle": person.jobTitle as Any,
        "nickname": person.nickname as Any,
        "photoUri": person.photoUri as Any
      ],
      "device": [
        "deviceName": device.name as Any,
        "manufacturer": "Apple",
        "model": device.model,
        "platform": "ios",
        "osName": device.systemName,
        "osVersion": device.systemVersion
      ],
      "crypto": [
        "deviceId": crypto.deviceId,
        "publicKey":
          crypto.publicKey.base64EncodedString()
      ],
      "identitySource": source,
      "identityConfidence": confidence,
      "diagnostics": [
        "contactsPermission": false,
        "phoneStatePermission": false,
        "phoneNumbersPermission": false,
        "androidUserProfileAttempted": false,
        "androidUserProfileFound": false,
        "androidSimPhoneAttempted": false,
        "androidSimPhoneFound": false,
        "androidPhoneContactMatchFound": false,
        "androidEmailContactMatchFound": false,
        "androidPhoneHintUsed": false,
        "androidContactPickerUsed": false,
        "androidAccountSelected": false,
        "iosContactsPermission":
          contactsPermission,
        "iosMeCardFound":
          meCardFound,
        "iosContactPickerUsed":
          pickerUsed,
        "truecallerInstalled": false,
        "truecallerUsed": false,
        "errors": errors
      ]
    ]
  }
}
