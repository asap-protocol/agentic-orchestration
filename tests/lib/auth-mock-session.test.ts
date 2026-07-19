import { describe, it, expect, vi, afterEach } from "vitest"
import {
  shouldUseStubAuthSession,
  getStubAuthSession,
} from "@/lib/auth-mock-session"

describe("shouldUseStubAuthSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is true when PLAYWRIGHT_E2E is set, even under NODE_ENV=production", () => {
    vi.stubEnv("PLAYWRIGHT_E2E", "1")
    vi.stubEnv("NODE_ENV", "production")
    expect(shouldUseStubAuthSession()).toBe(true)
  })

  it("is true in development", () => {
    vi.stubEnv("PLAYWRIGHT_E2E", "")
    vi.stubEnv("NODE_ENV", "development")
    expect(shouldUseStubAuthSession()).toBe(true)
  })

  it("is false when production and PLAYWRIGHT_E2E unset", () => {
    vi.stubEnv("PLAYWRIGHT_E2E", "")
    vi.stubEnv("NODE_ENV", "production")
    expect(shouldUseStubAuthSession()).toBe(false)
  })

  it("is false under NODE_ENV=test without Playwright", () => {
    vi.stubEnv("PLAYWRIGHT_E2E", "")
    vi.stubEnv("NODE_ENV", "test")
    expect(shouldUseStubAuthSession()).toBe(false)
  })
})

describe("getStubAuthSession", () => {
  it("returns fixed dev identifiers", () => {
    const s = getStubAuthSession()
    expect(s.user?.id).toBe("00000000-0000-0000-0000-000000000001")
    expect(s.user?.email).toBe("dev@example.com")
    expect(typeof s.expires).toBe("string")
  })
})
