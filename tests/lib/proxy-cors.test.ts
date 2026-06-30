import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

import { proxy } from "@/proxy"

const originalEnv = process.env

function apiRequest(
  path: string,
  options?: { origin?: string; method?: string },
): NextRequest {
  const headers = new Headers()
  if (options?.origin) {
    headers.set("origin", options.origin)
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options?.method ?? "POST",
    headers,
  })
}

describe("proxy API CORS and CSP", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com"
    delete process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.KV_REST_API_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.KV_REST_API_TOKEN
    delete process.env.PLAYWRIGHT_E2E
    delete process.env.CI
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("rejects cross-origin API requests from non-allowlisted origins with CSP", async () => {
    const response = await proxy(
      apiRequest("/api/workflows", { origin: "https://evil.example.com" }),
    )

    expect(response.status).toBe(403)
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
  })

  it("allows requests from the configured app origin and sets CORS headers", async () => {
    const response = await proxy(
      apiRequest("/api/workflows", { origin: "https://app.example.com" }),
    )

    expect(response.status).not.toBe(403)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
  })

  it("allows localhost origins during development", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    const response = await proxy(
      apiRequest("/api/workflows", { origin: "http://localhost:3001" }),
    )

    expect(response.status).not.toBe(403)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001")
  })

  it("responds to OPTIONS preflight for allowlisted origins", async () => {
    const response = await proxy(
      apiRequest("/api/workflows", {
        origin: "https://app.example.com",
        method: "OPTIONS",
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })
})
