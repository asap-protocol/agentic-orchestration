import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { getRateLimitClientId } from "@/lib/rate-limit-client-ip"

const originalEnv = process.env

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://app.example.com/api/workflows", { headers })
}

describe("getRateLimitClientId", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.RATE_LIMIT_CLIENT_IP_HEADER
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("uses the pinned trusted header when RATE_LIMIT_CLIENT_IP_HEADER is set", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = makeRequest({
      "CF-Connecting-IP": "203.0.113.10",
      "x-forwarded-for": "198.51.100.99",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.10")
  })

  it("takes the first non-empty segment from a comma-separated pinned header", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "True-Client-IP"
    const request = makeRequest({
      "True-Client-IP": " 203.0.113.20 , 198.51.100.1 ",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.20")
  })

  it("falls back to x-forwarded-for when the pinned header is missing", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = makeRequest({
      "x-forwarded-for": "198.51.100.5, 10.0.0.1",
    })

    expect(getRateLimitClientId(request)).toBe("198.51.100.5")
  })

  it("falls back to x-forwarded-for first hop when no pinned header is configured", () => {
    const request = makeRequest({
      "x-forwarded-for": "198.51.100.7, 10.0.0.2",
      "x-real-ip": "192.0.2.1",
    })

    expect(getRateLimitClientId(request)).toBe("198.51.100.7")
  })

  it("uses x-real-ip when x-forwarded-for is absent", () => {
    const request = makeRequest({
      "x-real-ip": "192.0.2.44",
    })

    expect(getRateLimitClientId(request)).toBe("192.0.2.44")
  })

  it('returns "anonymous" when no identifying headers are present', () => {
    expect(getRateLimitClientId(makeRequest({}))).toBe("anonymous")
  })

  it("ignores spoofed x-forwarded-for when a pinned header is configured and present", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = makeRequest({
      "CF-Connecting-IP": "203.0.113.99",
      "x-forwarded-for": "198.51.100.200",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.99")
  })

  it("treats whitespace-only RATE_LIMIT_CLIENT_IP_HEADER as unset", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "   "
    const request = makeRequest({
      "x-forwarded-for": "198.51.100.8",
    })

    expect(getRateLimitClientId(request)).toBe("198.51.100.8")
  })
})
