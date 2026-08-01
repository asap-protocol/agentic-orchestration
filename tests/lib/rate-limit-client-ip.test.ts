import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { getRateLimitClientId } from "@/lib/rate-limit-client-ip"

const originalEnv = process.env

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/agents", { headers })
}

describe("getRateLimitClientId", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.RATE_LIMIT_CLIENT_IP_HEADER
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("uses the first non-empty hop from x-forwarded-for when no pin is set", () => {
    const id = getRateLimitClientId(
      requestWithHeaders({ "x-forwarded-for": " 203.0.113.10, 198.51.100.1 " })
    )
    expect(id).toBe("203.0.113.10")
  })

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const id = getRateLimitClientId(requestWithHeaders({ "x-real-ip": "198.51.100.7" }))
    expect(id).toBe("198.51.100.7")
  })

  it("returns anonymous when no client IP headers are present", () => {
    expect(getRateLimitClientId(requestWithHeaders({}))).toBe("anonymous")
  })

  it("prefers the pinned trusted header over spoofable x-forwarded-for", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "cf-connecting-ip"
    const id = getRateLimitClientId(
      requestWithHeaders({
        "cf-connecting-ip": "203.0.113.55",
        "x-forwarded-for": "198.51.100.1",
      })
    )
    expect(id).toBe("203.0.113.55")
  })

  it("uses the first non-empty segment of a comma-split pinned header", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = " true-client-ip "
    const id = getRateLimitClientId(
      requestWithHeaders({
        "true-client-ip": " , 203.0.113.9 , 198.51.100.2",
      })
    )
    expect(id).toBe("203.0.113.9")
  })

  it("falls back when the pinned header is missing or empty", () => {
    process.env.RATE_LIMIT_CLIENT_IP_HEADER = "cf-connecting-ip"
    expect(
      getRateLimitClientId(
        requestWithHeaders({
          "cf-connecting-ip": "   ",
          "x-forwarded-for": "203.0.113.11",
        })
      )
    ).toBe("203.0.113.11")

    expect(
      getRateLimitClientId(requestWithHeaders({ "x-real-ip": "198.51.100.8" }))
    ).toBe("198.51.100.8")
  })
})
