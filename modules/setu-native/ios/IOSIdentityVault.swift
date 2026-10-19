import CryptoKit
import Darwin
import Foundation
import Security

final class IOSIdentityVault {
  private let keychainService = "com.setu.identity.vault"
  private let keychainAccount = "setu_vault_key_v1"
  private let vaultFilename = "setu_vault_v1.enc"
  private let temporaryFilename = "setu_vault_v1.enc.tmp"

  var isInitialized: Bool {
    FileManager.default.fileExists(atPath: vaultURL.path) && (try? loadKey()) != nil
  }

  func write(_ json: String) throws {
    let key: SymmetricKey
    if FileManager.default.fileExists(atPath: vaultURL.path) {
      guard let existingKey = try loadKey() else {
        throw vaultError("The vault key is missing; the existing vault was preserved")
      }
      key = existingKey
    } else {
      key = try loadOrCreateKey()
    }

    let sealed = try AES.GCM.seal(Data(json.utf8), using: key)
    guard let combined = sealed.combined else {
      throw vaultError("Unable to encode encrypted vault data")
    }

    let directory = vaultURL.deletingLastPathComponent()
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true
    )

    let temporaryURL = directory.appendingPathComponent(temporaryFilename)
    try base64URL(combined).write(to: temporaryURL, atomically: true, encoding: .utf8)

    if rename(temporaryURL.path, vaultURL.path) != 0 {
      let code = errno
      try? FileManager.default.removeItem(at: temporaryURL)
      throw NSError(
        domain: NSPOSIXErrorDomain,
        code: Int(code),
        userInfo: [NSLocalizedDescriptionKey: "Unable to atomically replace the Setu vault"]
      )
    }
  }

  func read() throws -> String? {
    guard FileManager.default.fileExists(atPath: vaultURL.path) else {
      return nil
    }
    guard let key = try loadKey() else {
      throw vaultError("The vault key is missing; the encrypted vault cannot be opened")
    }

    let encoded = try String(contentsOf: vaultURL, encoding: .utf8)
    guard let combined = decodeBase64URL(encoded) else {
      throw vaultError("The encrypted vault has an invalid encoding")
    }

    let sealed = try AES.GCM.SealedBox(combined: combined)
    let plaintext = try AES.GCM.open(sealed, using: key)
    guard let json = String(data: plaintext, encoding: .utf8) else {
      throw vaultError("The decrypted vault is not valid UTF-8")
    }
    return json
  }

  func destroy() throws {
    for url in [vaultURL, temporaryURL] where FileManager.default.fileExists(atPath: url.path) {
      try FileManager.default.removeItem(at: url)
    }

    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: keychainService,
      kSecAttrAccount: keychainAccount
    ]
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw NSError(
        domain: "IOSIdentityVault",
        code: Int(status),
        userInfo: [NSLocalizedDescriptionKey: "Unable to delete the Setu vault key"]
      )
    }
  }

  private var vaultURL: URL {
    applicationSupportDirectory.appendingPathComponent(vaultFilename)
  }

  private var temporaryURL: URL {
    applicationSupportDirectory.appendingPathComponent(temporaryFilename)
  }

  private var applicationSupportDirectory: URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
  }

  private func loadOrCreateKey() throws -> SymmetricKey {
    if let existingKey = try loadKey() {
      return existingKey
    }

    let key = SymmetricKey(size: .bits256)
    let keyData = key.withUnsafeBytes { Data($0) }
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: keychainService,
      kSecAttrAccount: keychainAccount,
      kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      kSecValueData: keyData
    ]
    let status = SecItemAdd(query as CFDictionary, nil)

    if status == errSecDuplicateItem, let existingKey = try loadKey() {
      return existingKey
    }
    guard status == errSecSuccess else {
      throw NSError(
        domain: "IOSIdentityVault",
        code: Int(status),
        userInfo: [NSLocalizedDescriptionKey: "Unable to store the Setu vault key"]
      )
    }
    return key
  }

  private func loadKey() throws -> SymmetricKey? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: keychainService,
      kSecAttrAccount: keychainAccount,
      kSecReturnData: true,
      kSecMatchLimit: kSecMatchLimitOne
    ]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let data = result as? Data else {
      throw NSError(
        domain: "IOSIdentityVault",
        code: Int(status),
        userInfo: [NSLocalizedDescriptionKey: "Unable to read the Setu vault key"]
      )
    }
    return SymmetricKey(data: data)
  }

  private func base64URL(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  private func decodeBase64URL(_ value: String) -> Data? {
    var base64 = value
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    let remainder = base64.count % 4
    if remainder != 0 {
      base64 += String(repeating: "=", count: 4 - remainder)
    }
    return Data(base64Encoded: base64)
  }

  private func vaultError(_ message: String) -> NSError {
    NSError(
      domain: "IOSIdentityVault",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }
}
