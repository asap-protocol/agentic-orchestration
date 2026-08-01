import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCookiesGet = vi.fn()
const mockAuth = vi.fn()
const mockVerifyPkceCookie = vi.fn()
const mockExchangeCodeForToken = vi.fn()
const mockGenerateAuthUrl = vi.fn()
const mockAddConnection = vi.fn()

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
  })),
}))

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}))

vi.mock("@/lib/oauth-manager", () => ({
  OAUTH_PKCE_COOKIE_NAME: "oauth_pkce",
  oauthManager: {
    verifyPkceCookie: (...args: unknown[]) => mockVerifyPkceCookie(...args),
    exchangeCodeForToken: (...args: unknown[]) => mockExchangeCodeForToken(...args),
    generateAuthUrl: (...args: unknown[]) => mockGenerateAuthUrl(...args),
  },
  getOAuthPkceCookieClearOptions: () => ({ maxAge: 0, path: "/" }),
  getOAuthPkceCookieSerializationOptions: () => ({ httpOnly: true, path: "/", maxAge: 600 }),
}))

vi.mock("@/lib/connector-store", () => ({
  connectorStore: {
    addConnection: (...args: unknown[]) => mockAddConnection(...args),
  },
}))

describe("OAuth API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
  })

  describe("GET /api/oauth/callback", () => {
    it("redirects with missing_parameters when code or state is absent", async () => {
      const { GET } = await import("@/app/api/oauth/callback/route")

      const response = await GET(new Request("http://localhost:3000/api/oauth/callback?code=abc"))
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("error=missing_parameters")
    })

    it("redirects provider error param to connectors page", async () => {
      const { GET } = await import("@/app/api/oauth/callback/route")

      const response = await GET(
        new Request("http://localhost:3000/api/oauth/callback?error=access_denied"),
      )
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("error=access_denied")
    })

    it("redirects with error when PKCE cookie verification fails", async () => {
      mockCookiesGet.mockReturnValue({ value: "tampered-cookie" })
      mockVerifyPkceCookie.mockResolvedValue(null)

      const { GET } = await import("@/app/api/oauth/callback/route")
      const response = await GET(
        new Request("http://localhost:3000/api/oauth/callback?code=abc&state=xyz"),
      )

      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("error=")
      expect(response.headers.get("location")).toContain("Invalid%20OAuth%20state")
    })

    it("stores connection and redirects on successful callback", async () => {
      mockCookiesGet.mockReturnValue({ value: "valid-pkce-cookie" })
      mockVerifyPkceCookie.mockResolvedValue({
        connectorId: "github",
        redirectUri: "http://localhost:3000/api/oauth/callback",
        state: "state-123",
      })
      mockExchangeCodeForToken.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      })

      const { GET } = await import("@/app/api/oauth/callback/route")
      const response = await GET(
        new Request("http://localhost:3000/api/oauth/callback?code=auth-code&state=state-123"),
      )

      expect(mockExchangeCodeForToken).toHaveBeenCalledWith("auth-code", {
        connectorId: "github",
        redirectUri: "http://localhost:3000/api/oauth/callback",
        state: "state-123",
      })
      expect(mockAddConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorId: "github",
          status: "connected",
          config: expect.objectContaining({
            authType: "oauth2",
            credentials: {
              accessToken: "access-token",
              refreshToken: "refresh-token",
            },
          }),
        }),
      )
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("success=connected")
    })
  })

  describe("POST /api/oauth/authorize", () => {
    it("returns 401 when session is missing", async () => {
      mockAuth.mockResolvedValue(null)

      const { POST } = await import("@/app/api/oauth/authorize/route")
      const response = await POST(
        new Request("http://localhost:3000/api/oauth/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: "github" }),
        }),
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("Unauthorized")
    })

    it("returns authUrl and sets PKCE cookie when authenticated", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } })
      mockGenerateAuthUrl.mockResolvedValue({
        authUrl: "https://github.com/login/oauth/authorize?state=abc",
        pkceCookieValue: "signed-pkce-value",
      })

      const { POST } = await import("@/app/api/oauth/authorize/route")
      const response = await POST(
        new Request("http://localhost:3000/api/oauth/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: "github" }),
        }),
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.authUrl).toContain("github.com")
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        "github",
        "http://localhost:3000/api/oauth/callback",
      )
      const setCookie = response.headers.get("set-cookie")
      expect(setCookie).toContain("oauth_pkce=signed-pkce-value")
    })

    it("returns 400 when generateAuthUrl throws", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } })
      mockGenerateAuthUrl.mockRejectedValue(new Error("Unknown connector"))

      const { POST } = await import("@/app/api/oauth/authorize/route")
      const response = await POST(
        new Request("http://localhost:3000/api/oauth/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: "unknown" }),
        }),
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("Unknown connector")
    })
  })
})
