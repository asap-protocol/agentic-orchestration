import { beforeEach, describe, expect, it } from "vitest"
import { connectorStore } from "@/lib/connector-store"

describe("connectorStore ownership isolation", () => {
  beforeEach(() => {
    connectorStore.clearConnections()
  })

  it("does not return another user's connections on list", () => {
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
      connectorId: "anthropic",
      name: "B Anthropic",
      status: "connected",
      config: {
        authType: "api_key",
        credentials: { apiKey: "sk-secret-b" },
      },
    })

    const forA = connectorStore.getConnections("user-a")
    expect(forA).toHaveLength(1)
    expect(forA[0]?.config.credentials?.apiKey).toBe("sk-secret-a")
    expect(connectorStore.getConnections("user-b")).toHaveLength(1)
    expect(connectorStore.getConnections("user-c")).toHaveLength(0)
  })

  it("rejects update and delete from a non-owner", () => {
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

    expect(
      connectorStore.updateConnection(owned.id, "user-b", {
        name: "Hijacked",
      }),
    ).toBeNull()
    expect(connectorStore.deleteConnection(owned.id, "user-b")).toBe(false)
    expect(connectorStore.getConnectionById(owned.id, "user-a")?.name).toBe("A OpenAI")
  })

  it("requires ownerUserId when adding a connection", () => {
    expect(() =>
      connectorStore.addConnection({
        ownerUserId: "",
        connectorId: "openai",
        name: "Missing owner",
        status: "connected",
        config: { authType: "api_key" },
      }),
    ).toThrow(/ownerUserId/)
  })
})
