import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authMock = vi.fn()
const cookiesMock = vi.fn()
const generateAuthUrlMock = vi.fn()
const verifyPkceCookieMock = vi.fn()
const exchangeCodeForTokenMock = vi.fn()
const refreshAccessTokenMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: authMock,
}))

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

vi.mock("@/lib/oauth-manager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth-manager")>()
  return {
    ...actual,
    oauthManager: {
      generateAuthUrl: generateAuthUrlMock,
      verifyPkceCookie: verifyPkceCookieMock,
      exchangeCodeForToken: exchangeCodeForTokenMock,
      refreshAccessToken: refreshAccessTokenMock,
    },
  }
})

type ConnectorStoreModule = typeof import("@/lib/connector-store")

describe("OAuth API routes", () => {
  let connectorStore: ConnectorStoreModule["connectorStore"]

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: "user-1" } })
    const mod: ConnectorStoreModule = await import("@/lib/connector-store")
    connectorStore = mod.connectorStore
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe("POST /api/oauth/authorize", () => {
    it("returns 401 when session is missing", async () => {
      authMock.mockResolvedValueOnce(null)
      const { POST } = await import("@/app/api/oauth/authorize/route")
      const response = await POST(
        new Request("http://localhost:3000/api/oauth/authorize", {
          method: "POST",
          body: JSON.stringify({ connectorId: "github" }),
        }),
      )
      expect(response.status).toBe(401)
    })

    it("returns authUrl and sets PKCE cookie for authenticated users", async () => {
      generateAuthUrlMock.mockResolvedValueOnce({
        authUrl: "https://github.com/login/oauth/authorize?state=abc",
        pkceCookieValue: "signed-pkce-cookie",
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
      const body = (await response.json()) as { authUrl: string }
      expect(body.authUrl).toContain("github.com")
      expect(response.cookies.get("oauth_pkce")?.value).toBe("signed-pkce-cookie")
    })

    it("returns 400 when connector id is invalid", async () => {
      generateAuthUrlMock.mockRejectedValueOnce(new Error("Unknown connector: evil"))
      const { POST } = await import("@/app/api/oauth/authorize/route")
      const response = await POST(
        new Request("http://localhost:3000/api/oauth/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: "evil" }),
        }),
      )
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string }
      expect(body.error).toContain("Unknown connector")
    })
  })

  describe("GET /api/oauth/callback", () => {
    it("redirects with provider error and clears PKCE cookie", async () => {
      const { GET } = await import("@/app/api/oauth/callback/route")
      const response = await GET(
        new NextRequest("http://localhost:3000/api/oauth/callback?error=access_denied"),
      )
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("error=access_denied")
      expect(response.cookies.get("oauth_pkce")?.value).toBe("")
    })

    it("redirects when code or state is missing", async () => {
      const { GET } = await import("@/app/api/oauth/callback/route")
      const response = await GET(
        new NextRequest("http://localhost:3000/api/oauth/callback?code=only-code"),
      )
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("missing_parameters")
    })

    it("redirects on invalid OAuth state", async () => {
      cookiesMock.mockResolvedValueOnce({
        get: () => ({ value: "bad-cookie" }),
      })
      verifyPkceCookieMock.mockResolvedValueOnce(null)
      const { GET } = await import("@/app/api/oauth/callback/route")
      const response = await GET(
        new NextRequest("http://localhost:3000/api/oauth/callback?code=abc&state=xyz"),
      )
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("Invalid%20OAuth%20state")
    })

    it("persists connection and redirects on successful exchange", async () => {
      cookiesMock.mockResolvedValueOnce({
        get: () => ({ value: "valid-cookie" }),
      })
      verifyPkceCookieMock.mockResolvedValueOnce({
        connectorId: "github",
        redirectUri: "http://localhost:3000/api/oauth/callback",
        state: "state-123",
        timestamp: Date.now(),
      })
      exchangeCodeForTokenMock.mockResolvedValueOnce({
        accessToken: "access-123",
        refreshToken: "refresh-456",
      })

      const { GET } = await import("@/app/api/oauth/callback/route")
      const response = await GET(
        new NextRequest(
          "http://localhost:3000/api/oauth/callback?code=auth-code&state=state-123",
        ),
      )
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("success=connected")
      expect(connectorStore.getConnectionsByConnector("github")).toHaveLength(1)
      expect(connectorStore.getConnectorById("github")?.status).toBe("connected")
    })
  })

  describe("POST /api/oauth/refresh", () => {
    it("returns 404 for unknown connection id", async () => {
      const { POST } = await import("@/app/api/oauth/refresh/route")
      const response = await POST(
        new Request("http://localhost:3000/api/oauth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: "missing" }),
        }),
      )
      expect(response.status).toBe(404)
    })

    it("returns 400 when connection has no refresh token", async () => {
      const connection = connectorStore.addConnection({
        connectorId: "github",
        name: "GitHub no refresh",
        status: "connected",
        config: {
          authType: "oauth2",
          credentials: { accessToken: "only-access" },
        },
      })
      const { POST } = await import("@/app/api/oauth/refresh/route")
      const response = await POST(
        new Request("http://localhost:3000/api/oauth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: connection.id }),
        }),
      )
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string }
      expect(body.error).toContain("No refresh token")
    })
  })
})
