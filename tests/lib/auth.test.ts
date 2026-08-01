import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { mockAuthInternal } = vi.hoisted(() => ({
  mockAuthInternal: vi.fn(),
}))

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: mockAuthInternal,
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

vi.mock("next-auth/providers/github", () => ({
  default: vi.fn(() => ({})),
}))

import { auth } from "@/auth"

const originalEnv = process.env

const realSession = {
  user: {
    id: "real-user-id",
    name: "Real User",
    email: "real@example.com",
  },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
}

describe("auth production guard", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    mockAuthInternal.mockReset()
    mockAuthInternal.mockResolvedValue(realSession)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns mock session in development without calling authInternal", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    delete process.env.PLAYWRIGHT_E2E

    const session = await auth()

    expect(session?.user?.id).toBe("00000000-0000-0000-0000-000000000001")
    expect(mockAuthInternal).not.toHaveBeenCalled()
  })

  it("never returns mock session when NODE_ENV is production", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.PLAYWRIGHT_E2E = "1"
    process.env.CI = "true"

    const session = await auth()

    expect(session?.user?.id).toBe("real-user-id")
    expect(mockAuthInternal).toHaveBeenCalledOnce()
  })

  it("never returns mock session in production even when only PLAYWRIGHT_E2E is set", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.PLAYWRIGHT_E2E = "1"
    delete process.env.CI

    const session = await auth()

    expect(session?.user?.id).toBe("real-user-id")
    expect(mockAuthInternal).toHaveBeenCalledOnce()
  })
})
