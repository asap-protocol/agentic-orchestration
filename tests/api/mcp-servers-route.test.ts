import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "@/app/api/mcp/servers/route"
import { DELETE, GET as GET_BY_ID } from "@/app/api/mcp/servers/[id]/route"
import { GET as GET_TOOLS } from "@/app/api/mcp/servers/[id]/tools/route"
import { POST as POST_CALL } from "@/app/api/mcp/tools/call/route"
import { mcpClient } from "@/lib/mcp-client"

const authMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}))

async function jsonOf(res: Response): Promise<unknown> {
  return res.json()
}

describe("api/mcp ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mcpClient.clearServers()
  })

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("does not leak another user's MCP environment on GET /servers", async () => {
    await mcpClient.connectServer({
      ownerUserId: "user-a",
      name: "Filesystem A",
      url: "http://127.0.0.1:3101",
      protocol: "http",
      environment: { TOKEN: "env-secret-a" },
    })
    await mcpClient.connectServer({
      ownerUserId: "user-b",
      name: "Filesystem B",
      url: "http://127.0.0.1:3102",
      protocol: "http",
      environment: { TOKEN: "env-secret-b" },
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await jsonOf(res)) as Array<{
      ownerUserId: string
      metadata?: { TOKEN?: string }
    }>
    expect(body).toHaveLength(1)
    expect(body[0].ownerUserId).toBe("user-b")
    expect(body[0].metadata?.TOKEN).toBe("env-secret-b")
  })

  it("ignores client-supplied ownerUserId on POST", async () => {
    authMock.mockResolvedValue({ user: { id: "user-real" } })
    const res = await POST(
      new Request("http://localhost/api/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerUserId: "user-attacker",
          name: "Memory Spoofed",
          url: "http://127.0.0.1:3103",
          protocol: "http",
          environment: { TOKEN: "should-belong-to-real" },
        }),
      }),
    )
    expect(res.status).toBe(201)
    const created = (await jsonOf(res)) as { ownerUserId: string; id: string }
    expect(created.ownerUserId).toBe("user-real")

    authMock.mockResolvedValue({ user: { id: "user-attacker" } })
    const leak = await GET()
    const leakBody = (await jsonOf(leak)) as unknown[]
    expect(leakBody).toHaveLength(0)
  })

  it("returns 404 when fetching another user's server by id", async () => {
    const owned = await mcpClient.connectServer({
      ownerUserId: "user-a",
      name: "Memory A",
      url: "http://127.0.0.1:3104",
      protocol: "http",
      environment: { TOKEN: "env-secret-a" },
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const res = await GET_BY_ID(new Request("http://localhost/api/mcp/servers/" + owned.id), {
      params: Promise.resolve({ id: owned.id }),
    })
    expect(res.status).toBe(404)
  })

  it("does not delete another user's server", async () => {
    const owned = await mcpClient.connectServer({
      ownerUserId: "user-a",
      name: "Filesystem A",
      url: "http://127.0.0.1:3105",
      protocol: "http",
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const res = await DELETE(new Request("http://localhost/api/mcp/servers/" + owned.id), {
      params: Promise.resolve({ id: owned.id }),
    })
    expect(res.status).toBe(404)
    expect(mcpClient.getServer(owned.id, "user-a")?.status).toBe("connected")
  })

  it("does not list tools for another user's server", async () => {
    const owned = await mcpClient.connectServer({
      ownerUserId: "user-a",
      name: "Filesystem A",
      url: "http://127.0.0.1:3106",
      protocol: "http",
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const res = await GET_TOOLS(
      new Request("http://localhost/api/mcp/servers/" + owned.id + "/tools"),
      {
        params: Promise.resolve({ id: owned.id }),
      },
    )
    expect(res.status).toBe(404)
  })

  it("does not execute another user's MCP tool", async () => {
    await mcpClient.connectServer({
      ownerUserId: "user-a",
      name: "Filesystem A",
      url: "http://127.0.0.1:3107",
      protocol: "http",
    })

    authMock.mockResolvedValue({ user: { id: "user-b" } })
    const res = await POST_CALL(
      new Request("http://localhost/api/mcp/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: "read_file", args: { path: "/etc/passwd" } }),
      }),
    )
    expect(res.status).toBe(400)
    const body = (await jsonOf(res)) as { error: string }
    expect(body.error).toContain("read_file")
  })
})
