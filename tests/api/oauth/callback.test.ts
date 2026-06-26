import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/oauth/callback/route"
import { cookies } from "next/headers"
import { OAUTH_PKCE_COOKIE_NAME, oauthManager } from "@/lib/oauth-manager"
import { connectorStore } from "@/lib/connector-store"

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}))

vi.mock("@/lib/oauth-manager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth-manager")>()
  return {
    ...actual,
    oauthManager: {
      verifyPkceCookie: vi.fn(),
      exchangeCodeForToken: vi.fn(),
    },
  }
})

describe("GET /api/oauth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "pkce-cookie-value" }),
    } as Awaited<ReturnType<typeof cookies>>)
  })

  it("redirects with provider error and clears PKCE cookie", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/oauth/callback?error=access_denied"),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/connectors?error=access_denied",
    )
    expect(response.headers.get("set-cookie")).toContain(`${OAUTH_PKCE_COOKIE_NAME}=`)
  })

  it("redirects when code or state is missing", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/oauth/callback?code=only-code"),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/connectors?error=missing_parameters",
    )
  })

  it("stores connection and redirects on successful OAuth exchange", async () => {
    const addConnection = vi.spyOn(connectorStore, "addConnection")
    vi.mocked(oauthManager.verifyPkceCookie).mockResolvedValue({
      connectorId: "github",
      redirectUri: "http://localhost:3000/api/oauth/callback",
      state: "state-123",
      timestamp: Date.now(),
    })
    vi.mocked(oauthManager.exchangeCodeForToken).mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    })

    const response = await GET(
      new Request(
        "http://localhost:3000/api/oauth/callback?code=auth-code&state=state-123",
      ),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/connectors?success=connected",
    )
    expect(oauthManager.verifyPkceCookie).toHaveBeenCalledWith("pkce-cookie-value", "state-123")
    expect(oauthManager.exchangeCodeForToken).toHaveBeenCalledWith("auth-code", {
      connectorId: "github",
      redirectUri: "http://localhost:3000/api/oauth/callback",
      state: "state-123",
      timestamp: expect.any(Number),
    })
    expect(addConnection).toHaveBeenCalledWith({
      connectorId: "github",
      name: "github Connection",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
      },
    })
  })

  it("redirects with error when PKCE verification fails", async () => {
    vi.mocked(oauthManager.verifyPkceCookie).mockResolvedValue(null)

    const response = await GET(
      new Request(
        "http://localhost:3000/api/oauth/callback?code=auth-code&state=bad-state",
      ),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/connectors?error=Invalid%20OAuth%20state",
    )
  })
})
