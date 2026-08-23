export interface Agent {
  id: string
  /** Authenticated owner. Omitted on shared seed templates that every user can read. */
  ownerUserId?: string
  name: string
  description: string
  model: string
  systemPrompt: string
  tools: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Tool {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  category: "web" | "data" | "code" | "utility"
}

export interface Run {
  id: string
  agentId: string
  agentName: string
  status: "running" | "completed" | "failed"
  startedAt: Date
  completedAt?: Date
  messages: Message[]
  toolCalls: ToolCall[]
}

export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

export interface ToolCall {
  id: string
  toolName: string
  input: Record<string, unknown>
  output?: unknown
  status: "pending" | "executing" | "completed" | "failed"
  startedAt: Date
  completedAt?: Date
  error?: string
}
