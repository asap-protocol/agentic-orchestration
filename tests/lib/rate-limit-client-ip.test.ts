import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

import { getRateLimitClientId } from "@/lib/rate-limit-client-ip"

const originalEnv = process.env

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/workflows", { headers })
}

describe("getRateLimitClientId", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.RATE_LIMIT_CLIENT_IP_HEADER
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("uses the pinned trusted header when configured", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = requestWithHeaders({
      "CF-Connecting-IP": "203.0.113.10, 198.51.100.1",
    })

    expect(getRateLimitClientId(request)).toBe("203.0.113.10")
  })

  it("falls back to x-forwarded-for when pinned header is missing", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "CF-Connecting-IP"
    const request = requestWithHeaders({
      "x-forwarded-for": "198.51.100.2, 10.0.0.1",
    })

    expect(getRateLimitClientId(request)).toBe("198.51.100.2")
  })

  it("uses x-forwarded-for first hop when no pinned header is set", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": " 192.0.2.44 , 10.0.0.5",
    })

    expect(getRateLimitClientId(request)).toBe("192.0.2.44")
  })

  it("uses x-real-ip when forwarded-for is absent", () => {
    const request = requestWithHeaders({
      "x-real-ip": "192.0.2.55",
    })

    expect(getRateLimitClientId(request)).toBe("192.0.2.55")
  })

  it("returns anonymous when no client IP headers are present", () => {
    const request = requestWithHeaders({})

    expect(getRateLimitClientId(request)).toBe("anonymous")
  })
})
