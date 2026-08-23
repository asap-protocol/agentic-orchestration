import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET as getAgents, POST as createAgent } from "@/app/api/agents/route"
import { DELETE, GET as getAgent, PATCH } from "@/app/api/agents/[id]/route"
import { store } from "@/lib/store"

const authMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}))

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: () => new Response("stream-ok"),
  })),
  convertToModelMessages: vi.fn(async (messages: unknown) => messages),
  tool: (def: unknown) => def,
}))

function sessionFor(userId: string): { user: { id: string } } {
  return { user: { id: userId } }
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function agentParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

const userAPrompt = {
  name: "User A Agent",
  description: "private to A",
  model: "gpt-4o",
  systemPrompt: "user-a-secret-system-prompt",
  tools: ["web-search"],
}

describe("api/agents ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.resetUserCreatedAgents()
  })

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null)
    const res = await getAgents()
    expect(res.status).toBe(401)
  })

  it("returns 401 when the session has no user id", async () => {
    authMock.mockResolvedValue({ user: {} })
    const res = await getAgents()
    expect(res.status).toBe(401)
  })

  it("does not leak another user's agent on GET", async () => {
    authMock.mockResolvedValue(sessionFor("user-a"))
    const created = await createAgent(
      jsonRequest("http://localhost/api/agents", "POST", userAPrompt),
    )
    expect(created.status).toBe(200)
    const createdBody = await created.json()
    expect(createdBody.ownerUserId).toBe("user-a")
    expect(createdBody.systemPrompt).toBe(userAPrompt.systemPrompt)

    authMock.mockResolvedValue(sessionFor("user-b"))
    const res = await getAgents()
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{
      id: string
      systemPrompt: string
      ownerUserId?: string
    }>
    expect(body.some((agent) => agent.systemPrompt === userAPrompt.systemPrompt)).toBe(false)
    expect(body.some((agent) => agent.id === "research-agent")).toBe(true)
    expect(body.some((agent) => agent.id === createdBody.id)).toBe(false)
  })

  it("ignores client-supplied ownerUserId on POST", async () => {
    authMock.mockResolvedValue(sessionFor("user-real"))
    const res = await createAgent(
      jsonRequest("http://localhost/api/agents", "POST", {
        ...userAPrompt,
        ownerUserId: "user-attacker",
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ownerUserId).toBe("user-real")
  })

  it("returns 401 on agent-by-id routes without a session", async () => {
    authMock.mockResolvedValue(null)
    const req = new Request("http://localhost/api/agents/research-agent")
    const res = await getAgent(req, agentParams("research-agent"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when another user fetches an agent by id", async () => {
    authMock.mockResolvedValue(sessionFor("user-a"))
    const created = await createAgent(
      jsonRequest("http://localhost/api/agents", "POST", userAPrompt),
    )
    const { id } = await created.json()

    authMock.mockResolvedValue(sessionFor("user-b"))
    const res = await getAgent(new Request(`http://localhost/api/agents/${id}`), agentParams(id))
    expect(res.status).toBe(404)
  })

  it("returns 404 when another user patches an agent", async () => {
    authMock.mockResolvedValue(sessionFor("user-a"))
    const created = await createAgent(
      jsonRequest("http://localhost/api/agents", "POST", userAPrompt),
    )
    const { id } = await created.json()

    authMock.mockResolvedValue(sessionFor("user-b"))
    const res = await PATCH(
      jsonRequest(`http://localhost/api/agents/${id}`, "PATCH", {
        systemPrompt: "hijacked",
        ownerUserId: "user-b",
      }),
      agentParams(id),
    )
    expect(res.status).toBe(404)

    authMock.mockResolvedValue(sessionFor("user-a"))
    const stillOwned = await getAgent(
      new Request(`http://localhost/api/agents/${id}`),
      agentParams(id),
    )
    const body = await stillOwned.json()
    expect(body.systemPrompt).toBe(userAPrompt.systemPrompt)
    expect(body.ownerUserId).toBe("user-a")
  })

  it("returns 404 when another user deletes an agent", async () => {
    authMock.mockResolvedValue(sessionFor("user-a"))
    const created = await createAgent(
      jsonRequest("http://localhost/api/agents", "POST", userAPrompt),
    )
    const { id } = await created.json()

    authMock.mockResolvedValue(sessionFor("user-b"))
    const res = await DELETE(
      new Request(`http://localhost/api/agents/${id}`, { method: "DELETE" }),
      agentParams(id),
    )
    expect(res.status).toBe(404)

    authMock.mockResolvedValue(sessionFor("user-a"))
    const stillThere = await getAgent(
      new Request(`http://localhost/api/agents/${id}`),
      agentParams(id),
    )
    expect(stillThere.status).toBe(200)
  })

  it("lets the owner update their own agent", async () => {
    authMock.mockResolvedValue(sessionFor("user-a"))
    const created = await createAgent(
      jsonRequest("http://localhost/api/agents", "POST", userAPrompt),
    )
    const { id } = await created.json()

    const res = await PATCH(
      jsonRequest(`http://localhost/api/agents/${id}`, "PATCH", { name: "Renamed" }),
      agentParams(id),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Renamed")
    expect(body.ownerUserId).toBe("user-a")
  })

  it("does not allow mutating shared seed templates", async () => {
    authMock.mockResolvedValue(sessionFor("user-a"))
    const patchRes = await PATCH(
      jsonRequest("http://localhost/api/agents/research-agent", "PATCH", {
        systemPrompt: "mutated-seed",
      }),
      agentParams("research-agent"),
    )
    expect(patchRes.status).toBe(404)

    const deleteRes = await DELETE(
      new Request("http://localhost/api/agents/research-agent", { method: "DELETE" }),
      agentParams("research-agent"),
    )
    expect(deleteRes.status).toBe(404)

    const stillSeed = await getAgent(
      new Request("http://localhost/api/agents/research-agent"),
      agentParams("research-agent"),
    )
    expect(stillSeed.status).toBe(200)
    const body = await stillSeed.json()
    expect(body.systemPrompt).not.toBe("mutated-seed")
    expect(body.ownerUserId).toBeUndefined()
  })
})

describe("api/playground/chat ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.resetUserCreatedAgents()
  })

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/playground/chat/route")
    authMock.mockResolvedValue(null)
    const res = await POST(
      jsonRequest("http://localhost/api/playground/chat", "POST", {
        messages: [],
        agentId: "research-agent",
      }),
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when chatting with another user's agent", async () => {
    const { POST } = await import("@/app/api/playground/chat/route")
    authMock.mockResolvedValue(sessionFor("user-a"))
    const created = await createAgent(
      jsonRequest("http://localhost/api/agents", "POST", userAPrompt),
    )
    const { id } = await created.json()

    authMock.mockResolvedValue(sessionFor("user-b"))
    const res = await POST(
      jsonRequest("http://localhost/api/playground/chat", "POST", {
        messages: [],
        agentId: id,
      }),
    )
    expect(res.status).toBe(404)
  })

  it("allows chatting with a shared seed template", async () => {
    const { POST } = await import("@/app/api/playground/chat/route")
    authMock.mockResolvedValue(sessionFor("user-b"))
    const res = await POST(
      jsonRequest("http://localhost/api/playground/chat", "POST", {
        messages: [],
        agentId: "research-agent",
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("stream-ok")
  })
})
