import { describe, it, expect } from "vitest"
import {
  registryAgentSchema,
  registryResponseSchema,
  revokedResponseSchema,
} from "@/lib/registry-schema"

const validAgent = {
  id: "urn:asap:agent:testuser:test-agent",
  name: "Test Agent",
  version: "1.0.0",
  description: "A test agent for unit testing",
  capabilities: {
    skills: [{ id: "skill-1", description: "Test skill" }],
  },
  endpoints: {
    asap: "https://example.com/asap",
    ws: "wss://example.com/ws",
  },
  auth: {
    schemes: ["bearer"],
    oauth2: {
      authorization_url: "https://example.com/auth",
      token_url: "https://example.com/token",
      scopes: ["read", "write"],
    },
  },
  sla: { max_response_time_seconds: 5 },
  repository_url: "https://github.com/test/repo",
  documentation_url: "https://docs.example.com",
  built_with: "langchain",
  category: "automation",
  tags: ["test", "automation"],
}

const minimalAgent = {
  id: "urn:asap:agent:user:minimal",
  name: "Minimal Agent",
  version: "0.1.0",
  description: "Agent with only required fields",
}

describe("registryAgentSchema", () => {
  it("validates a fully-populated agent", () => {
    const result = registryAgentSchema.safeParse(validAgent)
    expect(result.success).toBe(true)
  })

  it("validates an agent with only required fields", () => {
    const result = registryAgentSchema.safeParse(minimalAgent)
    expect(result.success).toBe(true)
  })

  it("passes through unknown fields (forward-compatibility)", () => {
    const agentWithExtra = { ...validAgent, new_future_field: "some value" }
    const result = registryAgentSchema.safeParse(agentWithExtra)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveProperty("new_future_field", "some value")
    }
  })

  it("rejects agent missing required 'id'", () => {
    const { id: _, ...noId } = validAgent
    const result = registryAgentSchema.safeParse(noId)
    expect(result.success).toBe(false)
  })

  it("rejects agent missing required 'name'", () => {
    const { name: _, ...noName } = validAgent
    const result = registryAgentSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  it("rejects agent with invalid version type", () => {
    const badVersion = { ...validAgent, version: 123 }
    const result = registryAgentSchema.safeParse(badVersion)
    expect(result.success).toBe(false)
  })

  it("rejects invalid repository_url", () => {
    const agentWithBadRepo = { ...validAgent, repository_url: "not-a-valid-url" }
    expect(registryAgentSchema.safeParse(agentWithBadRepo).success).toBe(false)
  })

  it("rejects invalid documentation_url", () => {
    const agentWithBadDocs = { ...validAgent, documentation_url: "not-a-valid-url" }
    expect(registryAgentSchema.safeParse(agentWithBadDocs).success).toBe(false)
  })

  it("accepts nullable fields as null", () => {
    const withNulls = {
      ...minimalAgent,
      repository_url: null,
      documentation_url: null,
      built_with: null,
      category: null,
    }
    const result = registryAgentSchema.safeParse(withNulls)
    expect(result.success).toBe(true)
  })
})

describe("registryResponseSchema", () => {
  it("validates a response with agents", () => {
    const result = registryResponseSchema.safeParse({
      agents: [validAgent, minimalAgent],
    })
    expect(result.success).toBe(true)
  })

  it("validates a response with empty agents array", () => {
    const result = registryResponseSchema.safeParse({ agents: [] })
    expect(result.success).toBe(true)
  })

  it("rejects a response without agents key", () => {
    const result = registryResponseSchema.safeParse({ data: [] })
    expect(result.success).toBe(false)
  })
})

describe("revokedResponseSchema", () => {
  it("validates a valid revoked response", () => {
    const result = revokedResponseSchema.safeParse({
      revoked: [
        {
          id: "urn:asap:agent:user:revoked",
          revoked_at: "2026-01-01T00:00:00Z",
          reason: "Violation",
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.revoked[0].urn).toBe("urn:asap:agent:user:revoked")
    }
  })

  it("accepts canonical urn on revoked entries", () => {
    const result = revokedResponseSchema.safeParse({
      revoked: [
        {
          urn: "urn:asap:agent:user:revoked-canonical",
          revoked_at: "2026-01-01T00:00:00Z",
          reason: "Violation",
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.revoked[0].urn).toBe("urn:asap:agent:user:revoked-canonical")
    }
  })

  it("prefers urn when both urn and id are present", () => {
    const result = revokedResponseSchema.safeParse({
      revoked: [
        {
          urn: "urn:asap:agent:user:preferred",
          id: "urn:asap:agent:user:legacy-fallback",
          revoked_at: "2026-01-01T00:00:00Z",
          reason: "Violation",
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.revoked[0].urn).toBe("urn:asap:agent:user:preferred")
    }
  })

  it("rejects revoked entry missing both urn and id", () => {
    const result = revokedResponseSchema.safeParse({
      revoked: [
        {
          revoked_at: "2026-01-01T00:00:00Z",
          reason: "Violation",
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("validates empty revoked agents", () => {
    const result = revokedResponseSchema.safeParse({ revoked: [] })
    expect(result.success).toBe(true)
  })
})
