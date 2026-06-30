import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

import { getRateLimitClientId } from "@/lib/rate-limit-client-ip"

const originalEnv = process.env

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/workflows", {
    method: "POST",
    headers,
  })
}

describe("getRateLimitClientId", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.RATE_LIMIT_CLIENT_IP_HEADER
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("uses the first non-empty segment from the pinned trusted header", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = requestWithHeaders({
      "CF-Connecting-IP": "203.0.113.1, 198.51.100.2",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.1")
  })

  it("falls back to x-forwarded-for when the pinned header is configured but missing", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = requestWithHeaders({
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.5")
  })

  it("uses the first x-forwarded-for hop when no pinned header is configured", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "198.51.100.7, proxy.internal",
    })

    expect(getRateLimitClientId(request)).toBe("198.51.100.7")
  })

  it("uses x-real-ip when forwarded headers are absent", () => {
    const request = requestWithHeaders({
      "x-real-ip": "192.0.2.44",
    })

    expect(getRateLimitClientId(request)).toBe("192.0.2.44")
  })

  it('returns "anonymous" when no client IP headers are present', () => {
    const request = requestWithHeaders({})

    expect(getRateLimitClientId(request)).toBe("anonymous")
  })
})
