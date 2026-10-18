// we always make sure 'react-native' gets included first
// eslint-disable-next-line no-restricted-imports
import * as ReactNative from "react-native"

import mockFile from "./mockFile"

// libraries to mock
jest.doMock("react-native", () => {
  return Object.setPrototypeOf(
    {
      Image: {
        ...ReactNative.Image,
        resolveAssetSource: jest.fn((_source) => mockFile),
        getSize: jest.fn(
          (
            uri: string,
            success: (width: number, height: number) => void,
            failure?: (_error: any) => void,
          ) => success(100, 100),
        ),
      },
    },
    ReactNative,
  )
})

jest.mock("i18next", () => ({
  currentLocale: "en",
  t: (key: string, params: Record<string, string>) => {
    return `${key} ${JSON.stringify(params)}`
  },
  translate: (key: string, params: Record<string, string>) => {
    return `${key} ${JSON.stringify(params)}`
  },
}))

jest.mock("expo-localization", () => ({
  ...jest.requireActual("expo-localization"),
  getLocales: () => [{ languageTag: "en-US", textDirection: "ltr" }],
}))

// Native SQLite isn't available under Jest; query helpers are tested without it.
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  openDatabaseSync: jest.fn(),
}))

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
  NotificationFeedbackType: { Success: "Success", Warning: "Warning", Error: "Error" },
}))

jest.mock("../src/i18n/index.ts", () => ({
  i18n: {
    isInitialized: true,
    language: "en",
    t: (key: string, params: Record<string, string>) => {
      return `${key} ${JSON.stringify(params)}`
    },
    numberToCurrency: jest.fn(),
  },
}))

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      data: {
        idToken: "mock-id-token",
        user: { id: "u-1", name: "Amit", email: "amit@example.com" },
      },
    }),
    signOut: jest.fn().mockResolvedValue(null),
    getTokens: jest.fn().mockResolvedValue({ accessToken: "mock-access-token", idToken: "mock-id-token" }),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
  isErrorWithCode: jest.fn(),
  isSuccessResponse: jest.fn(() => true),
}))

