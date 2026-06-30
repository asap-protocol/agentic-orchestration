import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

const mockAuthInternal = vi.hoisted(() => vi.fn())

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: mockAuthInternal,
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

vi.mock("next-auth/providers/github", () => ({
  default: vi.fn(),
}))

const originalEnv = process.env

describe("auth production guard", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthInternal.mockReset()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns the development mock session only in non-production dev mode", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    delete process.env.PLAYWRIGHT_E2E

    const { auth } = await import("@/auth")
    const session = await auth()

    expect(session?.user?.id).toBe("00000000-0000-0000-0000-000000000001")
    expect(mockAuthInternal).not.toHaveBeenCalled()
  })

  it("does not bypass auth in production even when PLAYWRIGHT_E2E is set", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.PLAYWRIGHT_E2E = "1"
    mockAuthInternal.mockResolvedValue({
      user: { id: "real-user-id", email: "user@example.com" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    })

    const { auth } = await import("@/auth")
    const session = await auth()

    expect(mockAuthInternal).toHaveBeenCalledTimes(1)
    expect(session?.user?.id).toBe("real-user-id")
  })

  it("uses NextAuth in test environments without an explicit E2E flag", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "test"
    delete process.env.PLAYWRIGHT_E2E
    mockAuthInternal.mockResolvedValue(null)

    const { auth } = await import("@/auth")
    const session = await auth()

    expect(mockAuthInternal).toHaveBeenCalledTimes(1)
    expect(session).toBeNull()
  })
})
