import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type ConnectorStoreModule = typeof import("@/lib/connector-store")

describe("connectorStore", () => {
  let connectorStore: ConnectorStoreModule["connectorStore"]

  beforeEach(async () => {
    vi.resetModules()
    const mod: ConnectorStoreModule = await import("@/lib/connector-store")
    connectorStore = mod.connectorStore
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("marks connector connected when a connection is added", () => {
    const before = connectorStore.getConnectorById("github")
    expect(before?.status).toBe("disconnected")

    connectorStore.addConnection({
      connectorId: "github",
      name: "GitHub OAuth",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: { accessToken: "gh-token" },
      },
    })

    const after = connectorStore.getConnectorById("github")
    expect(after?.status).toBe("connected")
    expect(connectorStore.getConnectionsByConnector("github")).toHaveLength(1)
  })

  it("resets connector to disconnected when its last connection is removed", () => {
    const connection = connectorStore.addConnection({
      connectorId: "notion",
      name: "Notion OAuth",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: { accessToken: "notion-token" },
      },
    })

    expect(connectorStore.getConnectorById("notion")?.status).toBe("connected")
    expect(connectorStore.deleteConnection(connection.id)).toBe(true)
    expect(connectorStore.getConnectorById("notion")?.status).toBe("disconnected")
    expect(connectorStore.getConnectionsByConnector("notion")).toHaveLength(0)
  })

  it("keeps connector connected when another connection for the same connector remains", () => {
    const first = connectorStore.addConnection({
      connectorId: "slack",
      name: "Slack workspace A",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: { accessToken: "slack-a" },
      },
    })
    const second = connectorStore.addConnection({
      connectorId: "slack",
      name: "Slack workspace B",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: { accessToken: "slack-b" },
      },
    })

    expect(connectorStore.deleteConnection(first.id)).toBe(true)
    expect(connectorStore.getConnectorById("slack")?.status).toBe("connected")
    expect(connectorStore.getConnectionsByConnector("slack")).toHaveLength(1)
    expect(connectorStore.getConnections().some((c) => c.id === second.id)).toBe(true)
  })

  it("returns null when updating an unknown connection id", () => {
    expect(connectorStore.updateConnection("missing-conn", { name: "noop" })).toBeNull()
  })

  it("filters connectors by category", () => {
    const mcpConnectors = connectorStore.getConnectorsByCategory("mcp")
    expect(mcpConnectors).toHaveLength(2)
    expect(mcpConnectors.every((c) => c.category === "mcp")).toBe(true)
  })
})
