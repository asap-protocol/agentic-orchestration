import type { Agent, Run, Tool } from "./types"

const defaultTools: Tool[] = [
  {
    id: "web-search",
    name: "web_search",
    description: "Search the web for current information",
    inputSchema: { query: { type: "string", description: "Search query" } },
    category: "web",
  },
  {
    id: "get-weather",
    name: "get_weather",
    description: "Get current weather for a location",
    inputSchema: { location: { type: "string", description: "City name" } },
    category: "data",
  },
  {
    id: "calculate",
    name: "calculate",
    description: "Perform mathematical calculations",
    inputSchema: { expression: { type: "string", description: "Math expression" } },
    category: "utility",
  },
  {
    id: "code-interpreter",
    name: "code_interpreter",
    description: "Execute Python code and return results",
    inputSchema: { code: { type: "string", description: "Python code to execute" } },
    category: "code",
  },
  {
    id: "file-search",
    name: "file_search",
    description: "Search through uploaded files",
    inputSchema: { query: { type: "string", description: "Search query" } },
    category: "data",
  },
]

const defaultAgents: Agent[] = [
  {
    id: "research-agent",
    name: "Research Assistant",
    description: "An agent that helps with web research and data gathering",
    model: "gpt-4o",
    systemPrompt:
      "You are a helpful research assistant. Use the available tools to find and analyze information for the user.",
    tools: ["web-search", "file-search"],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "code-agent",
    name: "Code Helper",
    description: "An agent for coding assistance and code execution",
    model: "gpt-4o",
    systemPrompt: "You are a coding assistant. Help users write, debug, and execute code.",
    tools: ["code-interpreter", "calculate"],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
]

class AgentStore {
  private agents: Map<string, Agent> = new Map()
  private tools: Map<string, Tool> = new Map()
  private runs: Map<string, Run> = new Map()

  constructor() {
    defaultAgents.forEach((agent) => this.agents.set(agent.id, agent))
    defaultTools.forEach((tool) => this.tools.set(tool.id, tool))
  }

  getAgents(ownerUserId: string): Agent[] {
    return Array.from(this.agents.values()).filter((agent) => this.canReadAgent(agent, ownerUserId))
  }

  getAgent(id: string, ownerUserId: string): Agent | undefined {
    const agent = this.agents.get(id)
    if (!agent || !this.canReadAgent(agent, ownerUserId)) return undefined
    return agent
  }

  createAgent(
    agent: Omit<Agent, "id" | "createdAt" | "updatedAt"> & { ownerUserId: string },
  ): Agent {
    if (typeof agent.ownerUserId !== "string" || agent.ownerUserId.length === 0) {
      throw new Error(
        `ownerUserId is required when creating an agent: received ${JSON.stringify(agent.ownerUserId)}, expected non-empty string`,
      )
    }
    const newAgent: Agent = {
      ...agent,
      ownerUserId: agent.ownerUserId,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.agents.set(newAgent.id, newAgent)
    return newAgent
  }

  updateAgent(
    id: string,
    ownerUserId: string,
    updates: Partial<Omit<Agent, "id" | "ownerUserId" | "createdAt">>,
  ): Agent | undefined {
    const agent = this.agents.get(id)
    if (!agent || !this.canMutateAgent(agent, ownerUserId)) return undefined
    const updated: Agent = {
      ...agent,
      ...updates,
      id: agent.id,
      ownerUserId: agent.ownerUserId,
      createdAt: agent.createdAt,
      updatedAt: new Date(),
    }
    this.agents.set(id, updated)
    return updated
  }

  deleteAgent(id: string, ownerUserId: string): boolean {
    const agent = this.agents.get(id)
    if (!agent || !this.canMutateAgent(agent, ownerUserId)) return false
    return this.agents.delete(id)
  }

  /**
   * Test-only: drop user-created agents between cases. Seed templates stay.
   */
  resetUserCreatedAgents(): void {
    const userAgentIds = [...this.agents.entries()]
      .filter(([, agent]) => agent.ownerUserId !== undefined)
      .map(([id]) => id)
    for (const id of userAgentIds) this.agents.delete(id)
  }

  private canReadAgent(agent: Agent, ownerUserId: string): boolean {
    return agent.ownerUserId === undefined || agent.ownerUserId === ownerUserId
  }

  private canMutateAgent(agent: Agent, ownerUserId: string): boolean {
    return agent.ownerUserId === ownerUserId
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id)
  }

  getRuns(): Run[] {
    return Array.from(this.runs.values()).sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    )
  }

  getRun(id: string): Run | undefined {
    return this.runs.get(id)
  }

  createRun(run: Omit<Run, "id">): Run {
    const newRun: Run = {
      ...run,
      id: crypto.randomUUID(),
    }
    this.runs.set(newRun.id, newRun)
    return newRun
  }

  updateRun(id: string, updates: Partial<Run>): Run | undefined {
    const run = this.runs.get(id)
    if (!run) return undefined
    const updated = { ...run, ...updates }
    this.runs.set(id, updated)
    return updated
  }
}

export const store = new AgentStore()
