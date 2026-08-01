import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"

const originalEnv = process.env

function request(
  pathname: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`), {
    method: init.method ?? "GET",
    headers: init.headers,
  })
}

describe("proxy", () => {
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

  it("rejects cross-origin API requests not in the allowlist with 403", async () => {
    const response = await proxy(
      request("/api/workflows", {
        headers: { origin: "https://evil.example.com" },
      }),
    )

    expect(response.status).toBe(403)
    expect(await response.text()).toBe("Forbidden")
  })

  it("rejects origin prefix spoofing (exact origin match required)", async () => {
    const response = await proxy(
      request("/api/workflows", {
        headers: { origin: "https://app.example.com.attacker.com" },
      }),
    )

    expect(response.status).toBe(403)
  })

  it("allows same-origin API requests from NEXT_PUBLIC_APP_URL", async () => {
    const response = await proxy(
      request("/api/workflows", {
        headers: { origin: "https://app.example.com" },
      }),
    )

    expect(response.status).not.toBe(403)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })

  it("allows localhost origins in development", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    const response = await proxy(
      request("/api/workflows", {
        headers: { origin: "http://localhost:3000" },
      }),
    )

    expect(response.status).not.toBe(403)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000")
  })

  it("sets Content-Security-Policy with a nonce on HTML routes", async () => {
    const response = await proxy(request("/dashboard"))

    const csp = response.headers.get("Content-Security-Policy")
    expect(csp).toBeTruthy()
    expect(csp).toContain("script-src 'self' 'nonce-")
    expect(csp).toContain("default-src 'self'")
  })

  it("responds to API OPTIONS preflight with CORS headers", async () => {
    const response = await proxy(
      request("/api/workflows", {
        method: "OPTIONS",
        headers: { origin: "https://app.example.com" },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })
})
