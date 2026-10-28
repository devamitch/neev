import { redirectSystemPath } from "../src/app/+native-intent"

describe("retired ecosystem deep links", () => {
  it.each([
    "neev://unified-vault?client_app=x&callback_url=evil://steal&payload=abc",
    "neev://unified-vault/callback?status=authorized&payload=abc",
    "/sso?app_id=x",
  ])("sends %s to the start screen without reading it", (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe("/")
  })

  it("leaves normal links alone", () => {
    expect(redirectSystemPath({ path: "/settings", initial: false })).toBe("/settings")
  })
})
