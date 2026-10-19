import Contacts
import ContactsUI
import Foundation
import UIKit

final class IOSContactPickerCoordinator:
  NSObject,
  CNContactPickerDelegate {

  private var picker: CNContactPickerViewController?
  private var completion:
    ((Result<SetuContactIdentity, Error>) -> Void)?

  func present(
    from viewController: UIViewController,
    completion: @escaping (
      Result<SetuContactIdentity, Error>
    ) -> Void
  ) {
    self.completion = completion

    let picker = CNContactPickerViewController()
    picker.delegate = self
    picker.displayedPropertyKeys = [
      CNContactGivenNameKey,
      CNContactMiddleNameKey,
      CNContactFamilyNameKey,
      CNContactNicknameKey,
      CNContactOrganizationNameKey,
      CNContactDepartmentNameKey,
      CNContactJobTitleKey,
      CNContactPhoneNumbersKey,
      CNContactEmailAddressesKey,
      CNContactThumbnailImageDataKey
    ]

    self.picker = picker

    viewController.present(
      picker,
      animated: true
    )
  }

  func contactPicker(
    _ picker: CNContactPickerViewController,
    didSelect contact: CNContact
  ) {
    completion?(.success(IOSContacts.convert(contact)))
    cleanup()
  }

  func contactPickerDidCancel(
    _ picker: CNContactPickerViewController
  ) {
    completion?(
      .failure(
        NSError(
          domain: "SetuContactPicker",
          code: 1,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Contact picker cancelled"
          ]
        )
      )
    )
    cleanup()
  }

  private func cleanup() {
    picker = nil
    completion = nil
  }
}
