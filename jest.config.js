/** @type {import('@jest/types').Config.ProjectConfig} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/test/setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|zustand|immer|firebase|@firebase)/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@assets/(.*)$": "<rootDir>/assets/$1",
  },
}
