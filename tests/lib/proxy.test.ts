import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

import { CSP_NONCE_HEADER } from "@/lib/csp-nonce-header"
import { proxy } from "@/proxy"

const originalEnv = process.env

function makeRequest(
  path: string,
  init?: { method?: string; headers?: Record<string, string> },
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, init)
}

describe("proxy", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    delete process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL
    delete process.env.PLAYWRIGHT_E2E
    delete process.env.CI
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("non-API routes", () => {
    it("sets Content-Security-Policy on page routes", async () => {
      const response = await proxy(makeRequest("/builder"))

      const csp = response.headers.get("Content-Security-Policy")
      expect(csp).toBeTruthy()
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/)
    })

    it("forwards x-nonce into request headers for Server Components", async () => {
      const response = await proxy(makeRequest("/workflows"))

      const nonce = response.headers.get(CSP_NONCE_HEADER)
      expect(nonce).toBeNull()
      expect(response.headers.get("Content-Security-Policy")).toMatch(
        /'nonce-[^']+'/,
      )
    })

    it("includes unsafe-eval in development CSP script-src", async () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"

      const response = await proxy(makeRequest("/"))
      const csp = response.headers.get("Content-Security-Policy")

      expect(csp).toContain("'unsafe-eval'")
    })

    it("omits unsafe-eval from production CSP script-src", async () => {
      ;(process.env as Record<string, string>).NODE_ENV = "production"

      const response = await proxy(makeRequest("/"))
      const csp = response.headers.get("Content-Security-Policy")

      expect(csp).not.toContain("unsafe-eval")
    })
  })

  describe("/api CORS", () => {
    it("allows same-origin requests when Origin matches NEXT_PUBLIC_APP_URL", async () => {
      const response = await proxy(
        makeRequest("/api/workflows", {
          method: "GET",
          headers: { Origin: "http://localhost:3000" },
        }),
      )

      expect(response.status).not.toBe(403)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      )
      expect(response.headers.get("Vary")).toBe("Origin")
    })

    it("allows NEXT_PUBLIC_ASAP_PROTOCOL_URL origin on API routes", async () => {
      process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL = "https://asap.example.com"

      const response = await proxy(
        makeRequest("/api/health", {
          method: "GET",
          headers: { Origin: "https://asap.example.com" },
        }),
      )

      expect(response.status).not.toBe(403)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://asap.example.com",
      )
    })

    it("allows http://localhost origins in development", async () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"

      const response = await proxy(
        makeRequest("/api/workflows", {
          method: "POST",
          headers: { Origin: "http://localhost:5173" },
        }),
      )

      expect(response.status).not.toBe(403)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:5173",
      )
    })

    it("returns 403 for cross-origin POST from an untrusted origin", async () => {
      ;(process.env as Record<string, string>).NODE_ENV = "production"

      const response = await proxy(
        makeRequest("/api/workflows", {
          method: "POST",
          headers: { Origin: "https://evil.com" },
        }),
      )

      expect(response.status).toBe(403)
      expect(await response.text()).toBe("Forbidden")
    })

    it("rejects javascript: pseudo-origin values", async () => {
      const response = await proxy(
        makeRequest("/api/workflows", {
          method: "POST",
          headers: { Origin: "javascript:alert(1)" },
        }),
      )

      expect(response.status).toBe(403)
    })

    it("handles OPTIONS preflight with CORS headers", async () => {
      const response = await proxy(
        makeRequest("/api/workflows", {
          method: "OPTIONS",
          headers: { Origin: "http://localhost:3000" },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "OPTIONS",
      )
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
        "Authorization",
      )
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      )
    })

    it("allows API requests without Origin header", async () => {
      const response = await proxy(
        makeRequest("/api/workflows", {
          method: "GET",
        }),
      )

      expect(response.status).not.toBe(403)
    })

    it("sets CSP on API responses including 403", async () => {
      const response = await proxy(
        makeRequest("/api/workflows", {
          method: "POST",
          headers: { Origin: "https://evil.com" },
        }),
      )

      expect(response.headers.get("Content-Security-Policy")).toBeTruthy()
    })
  })
})
