export const GRID_SIZE = 20

export const NODE_TYPES = [
  "agent",
  "start",
  "end",
  "guardrail",
  "condition",
  "mcp",
  "user-approval",
  "file-search",
  "frame",
] as const

export type SafeFetch = (url: string, options?: RequestInit) => Promise<Response>
