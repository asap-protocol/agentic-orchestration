import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { RegistryAgent } from "@/types/registry"
import { fetchRegistryAgents, getRegistryCategories } from "@/lib/registry"

const DEFAULT_REGISTRY_URL =
  process.env.NEXT_PUBLIC_REGISTRY_URL ??
  "https://raw.githubusercontent.com/asap-protocol/asap-protocol/main/registry.json"
const DEFAULT_REVOKED_URL =
  process.env.NEXT_PUBLIC_REVOKED_URL ??
  "https://raw.githubusercontent.com/asap-protocol/asap-protocol/main/revoked_agents.json"

const mockAgent1 = {
  id: "urn:asap:agent:user:agent-1",
  name: "Agent One",
  version: "1.0.0",
  description: "First test agent",
  category: "automation",
  tags: ["test"],
}

const mockAgent2 = {
  id: "urn:asap:agent:user:agent-2",
  name: "Agent Two",
  version: "2.0.0",
  description: "Second test agent",
  category: "analytics",
  tags: ["data"],
}

const mockRevokedAgent = {
  id: "urn:asap:agent:user:agent-revoked",
  name: "Revoked Agent",
  version: "0.1.0",
  description: "This agent is revoked",
  category: "automation",
}

function createFetchMock(registryResponse: unknown, revokedResponse: unknown) {
  let callCount = 0
  return vi.fn(() => {
    callCount++
    if (callCount === 1) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(registryResponse),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(revokedResponse),
    })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("fetchRegistryAgents", () => {
  it("returns agents from valid registry response", async () => {
    const mockFetch = createFetchMock({ agents: [mockAgent1, mockAgent2] }, { revoked: [] })
    vi.stubGlobal("fetch", mockFetch)

    const result = await fetchRegistryAgents()

    expect(result.agents).toHaveLength(2)
    expect(result.agents[0].name).toBe("Agent One")
    expect(result.agents[1].name).toBe("Agent Two")
    expect(result.error).toBeUndefined()
  })

  it("filters out revoked agents with legacy id field in revoked payload", async () => {
    const mockFetch = createFetchMock(
      { agents: [mockAgent1, mockRevokedAgent] },
      {
        revoked: [
          {
            id: mockRevokedAgent.id,
            revoked_at: "2026-01-01T00:00:00Z",
            reason: "Violation",
          },
        ],
      },
    )
    vi.stubGlobal("fetch", mockFetch)

    const result = await fetchRegistryAgents()

    expect(result.agents).toHaveLength(1)
    expect(result.agents[0].name).toBe("Agent One")
  })

  it("filters out revoked agents (canonical urn in revoked payload)", async () => {
    const mockFetch = createFetchMock(
      { agents: [mockAgent1, mockRevokedAgent] },
      {
        revoked: [
          {
            urn: mockRevokedAgent.id,
            revoked_at: "2026-01-01T00:00:00Z",
            reason: "Violation",
          },
        ],
      },
    )
    vi.stubGlobal("fetch", mockFetch)

    const result = await fetchRegistryAgents()

    expect(result.agents).toHaveLength(1)
    expect(result.agents[0].name).toBe("Agent One")
  })

  it("passes cache no-store and no next.revalidate for revoked list fetch", async () => {
    const mockFetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      if (urlStr === DEFAULT_REGISTRY_URL) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ agents: [mockAgent1] }),
        })
      }
      if (urlStr === DEFAULT_REVOKED_URL) {
        expect(init).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) })
        expect(init).not.toHaveProperty("next")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              revoked: [],
            }),
        })
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`)
    })

    vi.stubGlobal("fetch", mockFetch)

    await fetchRegistryAgents()

    const revokedCall = mockFetch.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0] === DEFAULT_REVOKED_URL,
    )
    expect(revokedCall).toBeDefined()
    expect(revokedCall?.[1]).toMatchObject({ cache: "no-store" })
    expect(revokedCall?.[1]).not.toHaveProperty("next")
  })

  it("uses default registry revalidate when NEXT_PUBLIC_REGISTRY_CACHE_SECONDS is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_REGISTRY_CACHE_SECONDS", "")
    const mockFetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      if (urlStr === DEFAULT_REGISTRY_URL) {
        expect(init).toMatchObject({ next: { revalidate: 60 } })
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ agents: [mockAgent1] }),
        })
      }
      if (urlStr === DEFAULT_REVOKED_URL) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ revoked: [] }),
        })
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`)
    })
    vi.stubGlobal("fetch", mockFetch)

    await fetchRegistryAgents()

    const registryCall = mockFetch.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0] === DEFAULT_REGISTRY_URL,
    )
    expect(registryCall?.[1]).toMatchObject({ next: { revalidate: 60 } })
  })

  it("uses NEXT_PUBLIC_REGISTRY_CACHE_SECONDS for registry fetch revalidate", async () => {
    vi.stubEnv("NEXT_PUBLIC_REGISTRY_CACHE_SECONDS", "120")
    const mockFetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      if (urlStr === DEFAULT_REGISTRY_URL) {
        expect(init).toMatchObject({ next: { revalidate: 120 } })
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ agents: [mockAgent1] }),
        })
      }
      if (urlStr === DEFAULT_REVOKED_URL) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ revoked: [] }),
        })
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`)
    })
    vi.stubGlobal("fetch", mockFetch)

    await fetchRegistryAgents()
  })

  it("clamps NEXT_PUBLIC_REGISTRY_CACHE_SECONDS to max 3600", async () => {
    vi.stubEnv("NEXT_PUBLIC_REGISTRY_CACHE_SECONDS", "99999")
    const mockFetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      if (urlStr === DEFAULT_REGISTRY_URL) {
        expect(init).toMatchObject({ next: { revalidate: 3600 } })
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ agents: [mockAgent1] }),
        })
      }
      if (urlStr === DEFAULT_REVOKED_URL) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ revoked: [] }),
        })
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`)
    })
    vi.stubGlobal("fetch", mockFetch)

    await fetchRegistryAgents()
  })

  it("returns empty array with error on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error"))),
    )

    const result = await fetchRegistryAgents()

    expect(result.agents).toEqual([])
    expect(result.error).toBeDefined()
  })

  it("returns empty array with error on non-OK HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 500, statusText: "Internal Server Error" })),
    )

    const result = await fetchRegistryAgents()

    expect(result.agents).toEqual([])
    expect(result.error).toContain("500")
  })

  it("returns empty array with error on malformed JSON", async () => {
    const mockFetch = createFetchMock({ not_agents: "bad data" }, { revoked: [] })
    vi.stubGlobal("fetch", mockFetch)

    const result = await fetchRegistryAgents()

    expect(result.agents).toEqual([])
    expect(result.error).toBeDefined()
  })

  it("returns empty agents with error when revoked list JSON is malformed", async () => {
    const mockFetch = createFetchMock({ agents: [mockAgent1] }, { revoked: "not an array" })
    vi.stubGlobal("fetch", mockFetch)

    const result = await fetchRegistryAgents()

    expect(result.agents).toEqual([])
    expect(result.error).toBe("Security restriction: Unable to verify revocation list.")
  })

  it("returns empty agents with error when revoked list fetch fails (fail closed)", async () => {
    let callCount = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ agents: [mockAgent1] }),
          })
        }
        return Promise.reject(new Error("Revoked list unavailable"))
      }),
    )

    const result = await fetchRegistryAgents()

    expect(result.agents).toEqual([])
    expect(result.error).toBe("Security restriction: Unable to verify revocation list.")
  })

  it("returns empty agents with error when revoked list HTTP is non-OK (fail closed)", async () => {
    let callCount = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ agents: [mockAgent1] }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        })
      }),
    )

    const result = await fetchRegistryAgents()

    expect(result.agents).toEqual([])
    expect(result.error).toBe("Security restriction: Unable to verify revocation list.")
  })

  it("returns empty agents for empty registry", async () => {
    const mockFetch = createFetchMock({ agents: [] }, { revoked: [] })
    vi.stubGlobal("fetch", mockFetch)

    const result = await fetchRegistryAgents()

    expect(result.agents).toEqual([])
    expect(result.error).toBeUndefined()
  })
})

describe("getRegistryCategories", () => {
  it("extracts unique categories sorted alphabetically", () => {
    const categories = getRegistryCategories([
      mockAgent1,
      mockAgent2,
      { ...mockAgent1, id: "dup", category: "automation" },
    ] as unknown as RegistryAgent[])

    expect(categories).toEqual(["analytics", "automation"])
  })

  it("excludes null/undefined categories", () => {
    const categories = getRegistryCategories([
      mockAgent1,
      { ...mockAgent2, category: null },
      { ...mockAgent1, id: "no-cat", category: undefined },
    ] as unknown as RegistryAgent[])

    expect(categories).toEqual(["automation"])
  })

  it("returns empty array for no agents", () => {
    expect(getRegistryCategories([])).toEqual([])
  })
})
