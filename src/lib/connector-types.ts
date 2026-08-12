export type ConnectionStatus = "connected" | "disconnected" | "error" | "pending"
export type AuthType = "api_key" | "oauth2" | "basic" | "mcp"
export type ConnectorCategory =
  | "storage"
  | "ai"
  | "productivity"
  | "communication"
  | "analytics"
  | "database"
  | "mcp"

export interface Connector {
  id: string
  name: string
  description: string
  category: ConnectorCategory
  authType: AuthType
  status: ConnectionStatus
  icon: string
  color: string
  website?: string
  docsUrl?: string
  isOfficial?: boolean
  isPremium?: boolean
}

export interface Connection {
  id: string
  /** Authenticated user that owns this connection; required for tenant isolation. */
  ownerUserId: string
  connectorId: string
  name: string
  status: ConnectionStatus
  config: ConnectionConfig
  createdAt: Date
  lastUsedAt?: Date
  metadata?: Record<string, unknown>
}

export interface ConnectionConfig {
  authType: AuthType
  credentials?: {
    apiKey?: string
    clientId?: string
    clientSecret?: string
    accessToken?: string
    refreshToken?: string
    username?: string
    password?: string
  }
  settings?: Record<string, unknown>
  mcpConfig?: MCPConfig
}

export interface MCPConfig {
  serverUrl: string
  protocol: "stdio" | "http"
  capabilities: string[]
  environment?: Record<string, string>
}

export interface OAuthFlow {
  connectorId: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  redirectUri: string
  state: string
}
