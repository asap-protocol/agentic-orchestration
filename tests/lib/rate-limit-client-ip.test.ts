import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { getRateLimitClientId } from "@/lib/rate-limit-client-ip"

const originalEnv = process.env

function apiRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL("http://localhost/api/workflows"), { headers })
}

describe("getRateLimitClientId", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.RATE_LIMIT_CLIENT_IP_HEADER
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("uses pinned header when RATE_LIMIT_CLIENT_IP_HEADER is set", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = apiRequest({
      "CF-Connecting-IP": "203.0.113.10",
      "x-forwarded-for": "198.51.100.99",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.10")
  })

  it("uses first non-empty segment from comma-separated pinned header", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "True-Client-IP"
    const request = apiRequest({
      "True-Client-IP": " 203.0.113.20 , 198.51.100.1 ",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.20")
  })

  it("falls back to x-forwarded-for when pinned header is missing", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = apiRequest({
      "x-forwarded-for": "198.51.100.50, 10.0.0.1",
    })

    expect(getRateLimitClientId(request)).toBe("198.51.100.50")
  })

  it("falls back to x-real-ip when forwarded header is absent", () => {
    const request = apiRequest({
      "x-real-ip": "192.0.2.44",
    })

    expect(getRateLimitClientId(request)).toBe("192.0.2.44")
  })

  it('returns "anonymous" when no IP headers are present', () => {
    expect(getRateLimitClientId(apiRequest({}))).toBe("anonymous")
  })
})
