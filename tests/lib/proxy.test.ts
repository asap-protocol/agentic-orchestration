import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mockLimit = vi.hoisted(() => vi.fn())

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    limit = (...args: unknown[]) => mockLimit(...args)
    constructor() {}
    static slidingWindow = vi.fn()
  }
  return { Ratelimit: MockRatelimit }
})

vi.mock("@upstash/redis", () => {
  class MockRedis {
    constructor() {}
  }
  return { Redis: MockRedis }
})

const originalEnv = process.env

function apiRequest(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? "GET",
    headers: init.headers,
  })
}

async function loadProxy() {
  vi.resetModules()
  const mod = await import("@/proxy")
  return mod.proxy
}

describe("proxy CORS and rate limiting", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.PLAYWRIGHT_E2E
    delete process.env.CI
    ;(process.env as Record<string, string>).NODE_ENV = "test"
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    delete process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL
    mockLimit.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it("rejects cross-origin /api requests with 403", async () => {
    const proxy = await loadProxy()
    const response = await proxy(
      apiRequest("/api/workflows", { headers: { origin: "https://evil.example" } }),
    )
    expect(response.status).toBe(403)
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
  })

  it("allows same-origin /api requests and sets CORS headers", async () => {
    const proxy = await loadProxy()
    const response = await proxy(
      apiRequest("/api/workflows", { headers: { origin: "http://localhost:3000" } }),
    )
    expect(response.status).not.toBe(403)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000")
    expect(response.headers.get("Vary")).toBe("Origin")
  })

  it("allows allowlisted ASAP protocol origin on /api routes", async () => {
    process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL = "https://asap.example.com"
    const proxy = await loadProxy()
    const response = await proxy(
      apiRequest("/api/health", { headers: { origin: "https://asap.example.com" } }),
    )
    expect(response.status).not.toBe(403)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://asap.example.com")
  })

  it("responds to OPTIONS preflight on /api routes", async () => {
    const proxy = await loadProxy()
    const response = await proxy(
      apiRequest("/api/workflows", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:3000" },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS")
  })

  it("returns 429 with rate-limit headers when limit is exceeded", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"
    mockLimit.mockResolvedValue({
      success: false,
      limit: 20,
      remaining: 0,
      reset: 1_700_000_000,
    })

    const proxy = await loadProxy()
    const response = await proxy(apiRequest("/api/workflows"))

    expect(mockLimit).toHaveBeenCalled()
    expect(response.status).toBe(429)
    expect(response.headers.get("X-RateLimit-Limit")).toBe("20")
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0")
    expect(response.headers.get("X-RateLimit-Reset")).toBe("1700000000")
  })

  it("passes through /api requests when rate limit is not exceeded", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"
    mockLimit.mockResolvedValue({
      success: true,
      limit: 20,
      remaining: 19,
      reset: 1_700_000_000,
    })

    const proxy = await loadProxy()
    const response = await proxy(apiRequest("/api/workflows"))

    expect(response.status).not.toBe(429)
    expect(response.status).not.toBe(403)
  })

  it("adds CSP header on non-/api routes", async () => {
    const proxy = await loadProxy()
    const response = await proxy(new NextRequest("http://localhost:3000/dashboard"))
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
  })
})
