import type { Connector, Connection } from "./connector-types"

class ConnectorStore {
  private connectors: Connector[] = [
    {
      id: "google-drive",
      name: "Google Drive",
      description: "Access and manage files in Google Drive",
      category: "storage",
      authType: "oauth2",
      status: "disconnected",
      icon: "📁",
      color: "var(--connector-google)",
      website: "https://drive.google.com",
      isOfficial: true,
    },
    {
      id: "dropbox",
      name: "Dropbox",
      description: "Store and share files with Dropbox",
      category: "storage",
      authType: "oauth2",
      status: "disconnected",
      icon: "📦",
      color: "var(--connector-dropbox)",
      isOfficial: true,
    },
    {
      id: "openai",
      name: "OpenAI",
      description: "Connect to OpenAI's GPT models",
      category: "ai",
      authType: "api_key",
      status: "connected",
      icon: "🤖",
      color: "var(--connector-openai)",
      isOfficial: true,
    },
    {
      id: "anthropic",
      name: "Anthropic",
      description: "Connect to Claude models",
      category: "ai",
      authType: "api_key",
      status: "disconnected",
      icon: "🧠",
      color: "var(--connector-anthropic)",
      isOfficial: true,
    },
    {
      id: "slack",
      name: "Slack",
      description: "Send messages and notifications to Slack",
      category: "communication",
      authType: "oauth2",
      status: "disconnected",
      icon: "💬",
      color: "var(--connector-slack)",
      isOfficial: true,
    },
    {
      id: "notion",
      name: "Notion",
      description: "Read and write to Notion databases",
      category: "productivity",
      authType: "oauth2",
      status: "disconnected",
      icon: "📝",
      color: "var(--connector-notion)",
      isOfficial: true,
    },
    {
      id: "github",
      name: "GitHub",
      description: "Access GitHub repositories and issues",
      category: "productivity",
      authType: "oauth2",
      status: "disconnected",
      icon: "🐙",
      color: "var(--connector-github)",
      isOfficial: true,
    },
    {
      id: "postgres",
      name: "PostgreSQL",
      description: "Connect to PostgreSQL databases",
      category: "database",
      authType: "basic",
      status: "disconnected",
      icon: "🐘",
      color: "var(--connector-postgres)",
      isOfficial: true,
    },
    {
      id: "mcp-filesystem",
      name: "MCP Filesystem",
      description: "Model Context Protocol for file operations",
      category: "mcp",
      authType: "mcp",
      status: "disconnected",
      icon: "📂",
      color: "var(--connector-mcp-filesystem)",
      isOfficial: true,
    },
    {
      id: "mcp-memory",
      name: "MCP Memory",
      description: "Model Context Protocol for knowledge graphs",
      category: "mcp",
      authType: "mcp",
      status: "disconnected",
      icon: "🧩",
      color: "var(--connector-mcp-memory)",
      isOfficial: true,
    },
  ]

  private connections: Connection[] = []

  getConnectors(): Connector[] {
    return this.connectors
  }

  getConnectorById(id: string): Connector | undefined {
    return this.connectors.find((c) => c.id === id)
  }

  getConnectorsByCategory(category: string): Connector[] {
    return this.connectors.filter((c) => c.category === category)
  }

  getConnections(ownerUserId: string): Connection[] {
    return this.connections.filter((c) => c.ownerUserId === ownerUserId)
  }

  getConnectionsByConnector(connectorId: string, ownerUserId: string): Connection[] {
    return this.connections.filter(
      (c) => c.connectorId === connectorId && c.ownerUserId === ownerUserId,
    )
  }

  getConnectionById(id: string, ownerUserId: string): Connection | undefined {
    return this.connections.find((c) => c.id === id && c.ownerUserId === ownerUserId)
  }

  addConnection(connection: Omit<Connection, "id" | "createdAt">): Connection {
    if (!connection.ownerUserId) {
      throw new Error("ownerUserId is required when adding a connection")
    }

    const newConnection: Connection = {
      ...connection,
      id: `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date(),
    }
    this.connections.push(newConnection)

    const connector = this.connectors.find((c) => c.id === connection.connectorId)
    if (connector) {
      connector.status = "connected"
    }

    return newConnection
  }

  updateConnection(
    id: string,
    ownerUserId: string,
    updates: Partial<Omit<Connection, "id" | "ownerUserId" | "createdAt">>,
  ): Connection | null {
    const index = this.connections.findIndex((c) => c.id === id && c.ownerUserId === ownerUserId)
    if (index === -1) return null

    this.connections[index] = { ...this.connections[index], ...updates }
    return this.connections[index]
  }

  deleteConnection(id: string, ownerUserId: string): boolean {
    const connection = this.connections.find((c) => c.id === id && c.ownerUserId === ownerUserId)
    if (!connection) return false

    this.connections = this.connections.filter((c) => c.id !== id)

    const hasOtherConnections = this.connections.some(
      (c) => c.connectorId === connection.connectorId,
    )
    if (!hasOtherConnections) {
      const connector = this.connectors.find((c) => c.id === connection.connectorId)
      if (connector) {
        connector.status = "disconnected"
      }
    }

    return true
  }

  testConnection(id: string, ownerUserId: string): Promise<{ success: boolean; message: string }> {
    const owned = this.getConnectionById(id, ownerUserId)
    if (!owned) {
      return Promise.resolve({ success: false, message: "Connection not found" })
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: Math.random() > 0.2,
          message: Math.random() > 0.2 ? "Connection successful" : "Failed to connect",
        })
      }, 1500)
    })
  }

  /** Test-only: drop all stored connections between cases. */
  clearConnections(): void {
    this.connections = []
  }
}

export const connectorStore = new ConnectorStore()
