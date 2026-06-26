import { describe, it, expect } from "vitest"
import { connectorStore } from "@/lib/connector-store"

describe("connectorStore", () => {
  it("addConnection assigns id and marks connector connected", () => {
    const connection = connectorStore.addConnection({
      connectorId: "slack",
      name: "Slack Workspace",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: {
          accessToken: "access-1",
          refreshToken: "refresh-1",
        },
      },
    })

    expect(connection.id).toMatch(/^conn-/)
    expect(connection.connectorId).toBe("slack")
    expect(connection.createdAt).toBeInstanceOf(Date)

    const slack = connectorStore.getConnectorById("slack")
    expect(slack?.status).toBe("connected")
    expect(connectorStore.getConnectionsByConnector("slack")).toContainEqual(connection)
  })

  it("updateConnection preserves refreshToken when only accessToken changes", () => {
    const connection = connectorStore.addConnection({
      connectorId: "github",
      name: "GitHub Org",
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: {
          accessToken: "old-access",
          refreshToken: "keep-refresh",
        },
      },
    })

    const updated = connectorStore.updateConnection(connection.id, {
      config: {
        ...connection.config,
        credentials: {
          ...connection.config.credentials,
          accessToken: "new-access",
        },
      },
    })

    expect(updated).not.toBeNull()
    expect(updated!.config.credentials?.accessToken).toBe("new-access")
    expect(updated!.config.credentials?.refreshToken).toBe("keep-refresh")
  })

  it("updateConnection returns null for unknown connection id", () => {
    const result = connectorStore.updateConnection("conn-missing", { name: "X" })
    expect(result).toBeNull()
  })

  it("deleteConnection disconnects connector when last connection removed", () => {
    const connection = connectorStore.addConnection({
      connectorId: "notion",
      name: "Notion Workspace",
      status: "connected",
      config: { authType: "oauth2" },
    })

    expect(connectorStore.deleteConnection(connection.id)).toBe(true)
    expect(connectorStore.getConnectorById("notion")?.status).toBe("disconnected")
    expect(connectorStore.getConnectionsByConnector("notion")).toHaveLength(0)
  })
})
