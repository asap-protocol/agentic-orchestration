import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { isE2ERateLimitBypass } from "@/proxy"

const originalEnv = process.env

describe("isE2ERateLimitBypass", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns false when PLAYWRIGHT_E2E and CI are unset (rate limit active)", () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    delete process.env.PLAYWRIGHT_E2E
    delete process.env.CI
    expect(isE2ERateLimitBypass()).toBe(false)
  })

  it("returns false in production even when PLAYWRIGHT_E2E=1", () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.PLAYWRIGHT_E2E = "1"
    process.env.CI = "true"
    expect(isE2ERateLimitBypass()).toBe(false)
  })

  it("returns false in production even when CI=true", () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.CI = "true"
    expect(isE2ERateLimitBypass()).toBe(false)
  })

  it("returns true when NODE_ENV is development and PLAYWRIGHT_E2E=1", () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    process.env.PLAYWRIGHT_E2E = "1"
    delete process.env.CI
    expect(isE2ERateLimitBypass()).toBe(true)
  })

  it("returns true when NODE_ENV is development and CI=true", () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    process.env.CI = "true"
    delete process.env.PLAYWRIGHT_E2E
    expect(isE2ERateLimitBypass()).toBe(true)
  })

  it("returns true when NODE_ENV is test and CI=true", () => {
    ;(process.env as Record<string, string>).NODE_ENV = "test"
    process.env.CI = "true"
    expect(isE2ERateLimitBypass()).toBe(true)
  })
})
