import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/oauth/authorize/route"
import { auth } from "@/auth"
import {
  OAUTH_PKCE_COOKIE_NAME,
  getOAuthPkceCookieSerializationOptions,
  oauthManager,
} from "@/lib/oauth-manager"

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/oauth-manager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth-manager")>()
  return {
    ...actual,
    oauthManager: {
      generateAuthUrl: vi.fn(),
    },
  }
})

describe("POST /api/oauth/authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when session is missing", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost:3000/api/oauth/authorize", {
        method: "POST",
        body: JSON.stringify({ connectorId: "github" }),
      }),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(oauthManager.generateAuthUrl).not.toHaveBeenCalled()
  })

  it("returns authUrl and sets PKCE cookie for authenticated session", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as Awaited<ReturnType<typeof auth>>)
    vi.mocked(oauthManager.generateAuthUrl).mockResolvedValue({
      authUrl: "https://github.com/login/oauth/authorize?state=abc123",
      pkceCookieValue: "signed-pkce-cookie",
    })

    const response = await POST(
      new Request("http://localhost:3000/api/oauth/authorize", {
        method: "POST",
        body: JSON.stringify({ connectorId: "github" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      authUrl: "https://github.com/login/oauth/authorize?state=abc123",
    })
    expect(oauthManager.generateAuthUrl).toHaveBeenCalledWith(
      "github",
      "http://localhost:3000/api/oauth/callback",
    )

    const cookieOptions = getOAuthPkceCookieSerializationOptions()
    const setCookieHeader = response.headers.get("set-cookie") ?? ""
    expect(setCookieHeader).toContain(OAUTH_PKCE_COOKIE_NAME)
    expect(setCookieHeader).toContain("signed-pkce-cookie")
    expect(cookieOptions.httpOnly).toBe(true)
  })

  it("returns 400 when generateAuthUrl throws", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as Awaited<ReturnType<typeof auth>>)
    vi.mocked(oauthManager.generateAuthUrl).mockRejectedValue(
      new Error("Unknown connector: missing"),
    )

    const response = await POST(
      new Request("http://localhost:3000/api/oauth/authorize", {
        method: "POST",
        body: JSON.stringify({ connectorId: "missing" }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Unknown connector: missing" })
  })
})
