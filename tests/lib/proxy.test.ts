import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

import { CSP_NONCE_HEADER } from "@/lib/csp-nonce-header"
import { proxy } from "@/proxy"

const originalEnv = process.env

function apiRequest(
  path: string,
  options: { origin?: string; method?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {}
  if (options.origin !== undefined) {
    headers.origin = options.origin
  }
  return new NextRequest(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers,
  })
}

describe("proxy", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com"
    delete process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("rejects disallowed cross-origin API requests with 403", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    const response = await proxy(apiRequest("/api/workflows", { origin: "https://evil.com" }))

    expect(response.status).toBe(403)
    expect(await response.text()).toBe("Forbidden")
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
  })

  it("allows same-origin API requests and sets CORS plus CSP headers", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    const response = await proxy(
      apiRequest("/api/workflows", { origin: "https://app.example.com" }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
    expect(response.headers.get("Vary")).toBe("Origin")
  })

  it("allows localhost origins in development", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    const response = await proxy(
      apiRequest("/api/workflows", { origin: "http://localhost:3000" }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000")
  })

  it("rejects localhost origins in production", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    const response = await proxy(
      apiRequest("/api/workflows", { origin: "http://localhost:3000" }),
    )

    expect(response.status).toBe(403)
  })

  it("allows API requests without an Origin header", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    const response = await proxy(apiRequest("/api/workflows"))

    expect(response.status).toBe(200)
  })

  it("responds to API OPTIONS preflight with allowed methods", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    const response = await proxy(
      apiRequest("/api/workflows", {
        origin: "https://app.example.com",
        method: "OPTIONS",
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })

  it("forwards CSP nonce on non-API routes", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    const response = await proxy(apiRequest("/dashboard"))

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
    expect(response.headers.get(CSP_NONCE_HEADER)).toBeNull()
  })
})
