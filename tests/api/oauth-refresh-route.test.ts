import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/oauth/refresh/route"
import { connectorStore } from "@/lib/connector-store"

const authMock = vi.fn()
const refreshAccessToken = vi.fn()

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}))

vi.mock("@/lib/oauth-manager", () => ({
  oauthManager: {
    refreshAccessToken: (...args: unknown[]) => refreshAccessToken(...args),
  },
}))

describe("api/oauth/refresh ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    connectorStore.clearConnections()
  })

  it("returns 404 when refreshing another user's connection", async () => {
    const owned = connectorStore.addConnection({
      ownerUserId: "user-a",
      connectorId: "github",
      name: "A GitHub",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: {
          accessToken: "access-a",
          refreshToken: "refresh-a",
        },
      },
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const res = await POST(
      new Request("http://localhost/api/oauth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: owned.id }),
      }),
    )

    expect(res.status).toBe(404)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it("refreshes tokens for the owning user", async () => {
    const owned = connectorStore.addConnection({
      ownerUserId: "user-a",
      connectorId: "github",
      name: "A GitHub",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: {
          accessToken: "access-a",
          refreshToken: "refresh-a",
        },
      },
    })

    authMock.mockResolvedValue({ user: { id: "user-a" } })
    refreshAccessToken.mockResolvedValue({ accessToken: "access-new" })

    const res = await POST(
      new Request("http://localhost/api/oauth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: owned.id }),
      }),
    )

    expect(res.status).toBe(200)
    expect(refreshAccessToken).toHaveBeenCalledWith("github", "refresh-a")
    expect(
      connectorStore.getConnectionById(owned.id, "user-a")?.config.credentials?.accessToken,
    ).toBe("access-new")
  })
})
