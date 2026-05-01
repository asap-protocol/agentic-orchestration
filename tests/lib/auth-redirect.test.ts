import { describe, it, expect } from "vitest"
import { resolveRedirectUrl } from "@/lib/auth-redirect"

describe("resolveRedirectUrl", () => {
  const baseUrl = "https://app.example.com"
  const asapUrl = "https://asap.example.com"

  it("returns url when it starts with asapUrl", () => {
    const url = "https://asap.example.com/callback?code=abc"
    expect(resolveRedirectUrl(url, baseUrl, asapUrl)).toBe(url)
  })

  it("returns url when it starts with asapUrl (path only)", () => {
    const url = "https://asap.example.com/"
    expect(resolveRedirectUrl(url, baseUrl, asapUrl)).toBe(url)
  })

  it("returns url when it starts with baseUrl (same-origin)", () => {
    const url = "https://app.example.com/dashboard"
    expect(resolveRedirectUrl(url, baseUrl, asapUrl)).toBe(url)
  })

  it("returns baseUrl when url is invalid (does not match asap or base)", () => {
    const url = "https://evil.com/phishing"
    expect(resolveRedirectUrl(url, baseUrl, asapUrl)).toBe(baseUrl)
  })

  it("returns url for same-origin when asapUrl is undefined", () => {
    const url = "https://app.example.com/settings"
    expect(resolveRedirectUrl(url, baseUrl, undefined)).toBe(url)
  })

  it("returns baseUrl for external url when asapUrl is undefined", () => {
    const url = "https://external.com/callback"
    expect(resolveRedirectUrl(url, baseUrl, undefined)).toBe(baseUrl)
  })

  it("ignores asapUrl when url does not start with it", () => {
    const url = "https://app.example.com/callback"
    expect(resolveRedirectUrl(url, baseUrl, asapUrl)).toBe(url)
  })

  it("rejects open-redirect via baseUrl prefix attack (origin spoofing)", () => {
    const url = "https://app.example.com.attacker.com/phish"
    expect(resolveRedirectUrl(url, baseUrl, asapUrl)).toBe(baseUrl)
  })

  it("rejects open-redirect via asapUrl prefix attack (origin spoofing)", () => {
    const url = "https://asap.example.com.attacker.com/phish"
    expect(resolveRedirectUrl(url, baseUrl, asapUrl)).toBe(baseUrl)
  })

  it("normalizes backslash-trick redirect to safe same-origin URL", () => {
    const url = "https://app.example.com\\@evil.com/path"
    const result = resolveRedirectUrl(url, baseUrl, asapUrl)
    expect(new URL(result).origin).toBe(baseUrl)
  })

  it("rejects malformed urls", () => {
    expect(resolveRedirectUrl("not-a-url", baseUrl, asapUrl)).toBe(baseUrl)
    expect(resolveRedirectUrl("javascript:alert(1)", baseUrl, asapUrl)).toBe(baseUrl)
    expect(resolveRedirectUrl("//evil.com/x", baseUrl, asapUrl)).toBe(baseUrl)
  })

  it("accepts exact baseUrl with no trailing path", () => {
    expect(resolveRedirectUrl(baseUrl, baseUrl, asapUrl)).toBe(baseUrl)
  })
})
