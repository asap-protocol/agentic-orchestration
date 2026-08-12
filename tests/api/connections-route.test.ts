import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "@/app/api/connections/route"
import { DELETE, PATCH } from "@/app/api/connections/[id]/route"
import { connectorStore } from "@/lib/connector-store"

const authMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}))

describe("api/connections ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    connectorStore.clearConnections()
  })

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("does not leak another user's credentials on GET", async () => {
    connectorStore.addConnection({
      ownerUserId: "user-a",
      connectorId: "openai",
      name: "A OpenAI",
      status: "connected",
      config: {
        authType: "api_key",
        credentials: { apiKey: "sk-secret-a" },
      },
    })
    connectorStore.addConnection({
      ownerUserId: "user-b",
      connectorId: "openai",
      name: "B OpenAI",
      status: "connected",
      config: {
        authType: "api_key",
        credentials: { apiKey: "sk-secret-b" },
      },
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].config.credentials.apiKey).toBe("sk-secret-b")
    expect(body[0].ownerUserId).toBe("user-b")
  })

  it("ignores client-supplied ownerUserId on POST", async () => {
    authMock.mockResolvedValue({ user: { id: "user-real" } })
    const res = await POST(
      new Request("http://localhost/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerUserId: "user-attacker",
          connectorId: "openai",
          name: "Spoofed",
          status: "connected",
          config: {
            authType: "api_key",
            credentials: { apiKey: "sk-new" },
          },
        }),
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ownerUserId).toBe("user-real")
    expect(connectorStore.getConnections("user-attacker")).toHaveLength(0)
    expect(connectorStore.getConnections("user-real")).toHaveLength(1)
  })

  it("returns 404 when a non-owner tries to PATCH or DELETE", async () => {
    const owned = connectorStore.addConnection({
      ownerUserId: "user-a",
      connectorId: "openai",
      name: "A OpenAI",
      status: "connected",
      config: {
        authType: "api_key",
        credentials: { apiKey: "sk-secret-a" },
      },
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const params = Promise.resolve({ id: owned.id })

    const patchRes = await PATCH(
      new Request(`http://localhost/api/connections/${owned.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hijacked" }),
      }),
      { params },
    )
    expect(patchRes.status).toBe(404)

    const deleteRes = await DELETE(
      new Request(`http://localhost/api/connections/${owned.id}`, { method: "DELETE" }),
      { params },
    )
    expect(deleteRes.status).toBe(404)
    expect(connectorStore.getConnectionById(owned.id, "user-a")?.name).toBe("A OpenAI")
  })
})
