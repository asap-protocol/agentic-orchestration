import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/oauth/refresh/route"
import { auth } from "@/auth"
import { oauthManager } from "@/lib/oauth-manager"
import { connectorStore } from "@/lib/connector-store"

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/oauth-manager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth-manager")>()
  return {
    ...actual,
    oauthManager: {
      refreshAccessToken: vi.fn(),
    },
  }
})

describe("POST /api/oauth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when session is missing", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost:3000/api/oauth/refresh", {
        method: "POST",
        body: JSON.stringify({ connectionId: "conn-1" }),
      }),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 404 when connection is not found", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as Awaited<ReturnType<typeof auth>>)
    vi.spyOn(connectorStore, "getConnections").mockReturnValue([])

    const response = await POST(
      new Request("http://localhost:3000/api/oauth/refresh", {
        method: "POST",
        body: JSON.stringify({ connectionId: "conn-missing" }),
      }),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Connection not found" })
  })

  it("returns 400 when connection has no refresh token", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as Awaited<ReturnType<typeof auth>>)
    vi.spyOn(connectorStore, "getConnections").mockReturnValue([
      {
        id: "conn-1",
        connectorId: "github",
        name: "GitHub",
        status: "connected",
        createdAt: new Date(),
        config: {
          authType: "oauth2",
          credentials: { accessToken: "old-access" },
        },
      },
    ])

    const response = await POST(
      new Request("http://localhost:3000/api/oauth/refresh", {
        method: "POST",
        body: JSON.stringify({ connectionId: "conn-1" }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "No refresh token available" })
  })

  it("refreshes access token and preserves refresh token", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as Awaited<ReturnType<typeof auth>>)

    const existingConnection = {
      id: "conn-refresh",
      connectorId: "github",
      name: "GitHub",
      status: "connected" as const,
      createdAt: new Date(),
      config: {
        authType: "oauth2" as const,
        credentials: {
          accessToken: "old-access",
          refreshToken: "keep-refresh",
        },
      },
    }

    vi.spyOn(connectorStore, "getConnections").mockReturnValue([existingConnection])
    vi.mocked(oauthManager.refreshAccessToken).mockResolvedValue({
      accessToken: "new-access",
    })
    const updateConnection = vi
      .spyOn(connectorStore, "updateConnection")
      .mockReturnValue(existingConnection)

    const response = await POST(
      new Request("http://localhost:3000/api/oauth/refresh", {
        method: "POST",
        body: JSON.stringify({ connectionId: "conn-refresh" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(oauthManager.refreshAccessToken).toHaveBeenCalledWith("github", "keep-refresh")
    expect(updateConnection).toHaveBeenCalledWith("conn-refresh", {
      config: {
        ...existingConnection.config,
        credentials: {
          accessToken: "new-access",
          refreshToken: "keep-refresh",
        },
      },
    })
  })
})
