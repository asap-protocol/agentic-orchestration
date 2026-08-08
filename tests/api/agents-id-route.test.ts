import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, PATCH, DELETE } from "@/app/api/agents/[id]/route"

const authMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}))

const params = Promise.resolve({ id: "research-agent" })

describe("api/agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 for unauthenticated GET", async () => {
    authMock.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost/api/agents/research-agent"), { params })
    expect(res.status).toBe(401)
  })

  it("returns 401 for unauthenticated PATCH", async () => {
    authMock.mockResolvedValue(null)
    const res = await PATCH(
      new Request("http://localhost/api/agents/research-agent", {
        method: "PATCH",
        body: JSON.stringify({ name: "Hijacked" }),
      }),
      { params },
    )
    expect(res.status).toBe(401)
  })

  it("returns 401 for unauthenticated DELETE", async () => {
    authMock.mockResolvedValue(null)
    const res = await DELETE(new Request("http://localhost/api/agents/research-agent"), { params })
    expect(res.status).toBe(401)
  })

  it("allows authenticated GET", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } })
    const res = await GET(new Request("http://localhost/api/agents/research-agent"), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("research-agent")
  })
})
