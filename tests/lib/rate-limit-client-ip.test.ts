import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { getRateLimitClientId } from "@/lib/rate-limit-client-ip"

const originalEnv = process.env

function apiRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/foo", { headers })
}

describe("getRateLimitClientId", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.RATE_LIMIT_CLIENT_IP_HEADER
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("uses pinned trusted header when RATE_LIMIT_CLIENT_IP_HEADER is set", () => {
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
      "True-Client-IP": " 203.0.113.5 , 198.51.100.1 ",
    })
    expect(getRateLimitClientId(request)).toBe("203.0.113.5")
  })

  it("falls back to x-forwarded-for when pinned header is missing", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = apiRequest({
      "x-forwarded-for": "198.51.100.77, 10.0.0.1",
    })
    expect(getRateLimitClientId(request)).toBe("198.51.100.77")
  })

  it("uses x-forwarded-for first hop when no pinned header is configured", () => {
    const request = apiRequest({
      "x-forwarded-for": "203.0.113.42, 10.0.0.5",
    })
    expect(getRateLimitClientId(request)).toBe("203.0.113.42")
  })

  it("uses x-real-ip when x-forwarded-for is absent", () => {
    const request = apiRequest({ "x-real-ip": "203.0.113.88" })
    expect(getRateLimitClientId(request)).toBe("203.0.113.88")
  })

  it('returns "anonymous" when no identifying headers are present', () => {
    expect(getRateLimitClientId(apiRequest())).toBe("anonymous")
  })
})
