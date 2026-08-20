export interface MCPServer {
  id: string
  /** Authenticated user that owns this MCP registration; required for tenant isolation. */
  ownerUserId: string
  name: string
  url: string
  protocol: "stdio" | "http"
  capabilities: MCPCapability[]
  status: "connected" | "disconnected" | "error"
  metadata?: Record<string, unknown>
}

export interface MCPCapability {
  type: "tools" | "resources" | "prompts" | "sampling"
  description: string
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverId: string
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
  serverId: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
  serverId: string
}

class MCPClient {
  private servers: Map<string, MCPServer> = new Map()
  private tools: Map<string, MCPTool> = new Map()
  private resources: Map<string, MCPResource> = new Map()
  private prompts: Map<string, MCPPrompt> = new Map()

  async connectServer(config: {
    name: string
    url: string
    protocol: "stdio" | "http"
    environment?: Record<string, string>
    ownerUserId: string
  }): Promise<MCPServer> {
    if (!config.ownerUserId) {
      throw new Error("ownerUserId is required when connecting an MCP server")
    }

    const serverId = `mcp-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const server: MCPServer = {
      id: serverId,
      ownerUserId: config.ownerUserId,
      name: config.name,
      url: config.url,
      protocol: config.protocol,
      capabilities: [
        { type: "tools", description: "Execute tools via MCP protocol" },
        { type: "resources", description: "Access resources via MCP protocol" },
        { type: "prompts", description: "Use prompt templates" },
      ],
      status: "connected",
      metadata: config.environment,
    }

    this.servers.set(serverId, server)

    await this.discoverCapabilities(serverId)

    return server
  }

  async discoverCapabilities(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) throw new Error("Server not found")

    if (server.name.includes("Filesystem")) {
      this.tools.set(`${serverId}-read`, {
        name: "read_file",
        description: "Read contents of a file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to read" },
          },
          required: ["path"],
        },
        serverId,
      })

      this.tools.set(`${serverId}-write`, {
        name: "write_file",
        description: "Write contents to a file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to write" },
            content: { type: "string", description: "Content to write" },
          },
          required: ["path", "content"],
        },
        serverId,
      })

      this.tools.set(`${serverId}-list`, {
        name: "list_directory",
        description: "List files in a directory",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path" },
          },
          required: ["path"],
        },
        serverId,
      })
    } else if (server.name.includes("Memory")) {
      this.tools.set(`${serverId}-store`, {
        name: "store_memory",
        description: "Store information in knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "Memory key" },
            value: { type: "string", description: "Memory value" },
            metadata: { type: "object", description: "Optional metadata" },
          },
          required: ["key", "value"],
        },
        serverId,
      })

      this.tools.set(`${serverId}-recall`, {
        name: "recall_memory",
        description: "Retrieve information from knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
        serverId,
      })

      this.tools.set(`${serverId}-relate`, {
        name: "create_relation",
        description: "Create relationship between entities",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Source entity" },
            relation: { type: "string", description: "Relation type" },
            to: { type: "string", description: "Target entity" },
          },
          required: ["from", "relation", "to"],
        },
        serverId,
      })
    }
  }

  async disconnectServer(serverId: string, ownerUserId: string): Promise<void> {
    const server = this.getServer(serverId, ownerUserId)
    if (!server) {
      throw new Error(`Server not found: received ${serverId}, expected an id owned by the caller`)
    }

    server.status = "disconnected"

    for (const [key, tool] of this.tools.entries()) {
      if (tool.serverId === serverId) {
        this.tools.delete(key)
      }
    }

    for (const [key, resource] of this.resources.entries()) {
      if (resource.serverId === serverId) {
        this.resources.delete(key)
      }
    }

    for (const [key, prompt] of this.prompts.entries()) {
      if (prompt.serverId === serverId) {
        this.prompts.delete(key)
      }
    }
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    ownerUserId: string,
  ): Promise<unknown> {
    const tool = Array.from(this.tools.values()).find((t) => {
      if (t.name !== toolName) return false
      return this.getServer(t.serverId, ownerUserId) !== undefined
    })
    if (!tool) throw new Error(`Tool ${toolName} not found`)

    const server = this.getServer(tool.serverId, ownerUserId)
    if (!server || server.status !== "connected") {
      throw new Error("MCP server not connected")
    }

    if (toolName === "read_file") {
      return { content: "File content from MCP server", mimeType: "text/plain" }
    } else if (toolName === "write_file") {
      return { success: true, path: args.path }
    } else if (toolName === "list_directory") {
      return { files: ["file1.txt", "file2.txt", "subdirectory/"] }
    } else if (toolName === "store_memory") {
      return { success: true, key: args.key }
    } else if (toolName === "recall_memory") {
      return {
        results: [
          { key: "example", value: "stored information", relevance: 0.95 },
          { key: "another", value: "more data", relevance: 0.82 },
        ],
      }
    } else if (toolName === "create_relation") {
      return { success: true, relation: `${args.from} -> ${args.relation} -> ${args.to}` }
    }

    return { success: true }
  }

  getServers(ownerUserId: string): MCPServer[] {
    return Array.from(this.servers.values()).filter((s) => s.ownerUserId === ownerUserId)
  }

  getServer(serverId: string, ownerUserId: string): MCPServer | undefined {
    const server = this.servers.get(serverId)
    if (!server || server.ownerUserId !== ownerUserId) return undefined
    return server
  }

  getToolsByServer(serverId: string, ownerUserId: string): MCPTool[] {
    if (!this.getServer(serverId, ownerUserId)) return []
    return Array.from(this.tools.values()).filter((t) => t.serverId === serverId)
  }

  getAllTools(ownerUserId: string): MCPTool[] {
    return Array.from(this.tools.values()).filter(
      (t) => this.getServer(t.serverId, ownerUserId) !== undefined,
    )
  }

  getResourcesByServer(serverId: string, ownerUserId: string): MCPResource[] {
    if (!this.getServer(serverId, ownerUserId)) return []
    return Array.from(this.resources.values()).filter((r) => r.serverId === serverId)
  }

  getPromptsByServer(serverId: string, ownerUserId: string): MCPPrompt[] {
    if (!this.getServer(serverId, ownerUserId)) return []
    return Array.from(this.prompts.values()).filter((p) => p.serverId === serverId)
  }

  /** Test-only: drop all stored MCP registrations between cases. */
  clearServers(): void {
    this.servers.clear()
    this.tools.clear()
    this.resources.clear()
    this.prompts.clear()
  }
}

export const mcpClient = new MCPClient()
