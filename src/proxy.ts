import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

import { CSP_NONCE_HEADER } from "@/lib/csp-nonce-header"
import { getRateLimitClientId } from "@/lib/rate-limit-client-ip"

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

export function isE2ERateLimitBypass(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.PLAYWRIGHT_E2E === "1" || process.env.CI === "true")
  )
}

// Create a global rate limiter instance allowing 20 requests per 10 seconds (only active if env vars are present).
const ratelimit =
  redisUrl && redisToken
    ? new Ratelimit({
        redis: new Redis({
          url: redisUrl,
          token: redisToken,
        }),
        limiter: Ratelimit.slidingWindow(20, "10 s"),
        analytics: true,
      })
    : null

function safeOrigin(value: string | undefined | null): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.origin
  } catch {
    return null
  }
}

function buildContentSecurityPolicy(nonce: string): string {
  const scriptExtra = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  // style-src keeps 'unsafe-inline' for Tailwind v4 and ChartStyle theme CSS (dangerouslySetInnerHTML).
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com${scriptExtra}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://raw.githubusercontent.com https://vitals.vercel-insights.com https://vitals.vercel-analytics.com https://api.github.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ")
}

function requestHeadersWithNonce(request: NextRequest, nonce: string): Headers {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(CSP_NONCE_HEADER, nonce)
  return requestHeaders
}

function withCsp(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce))
  return response
}

export async function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64")
  const requestHeaders = requestHeadersWithNonce(request, nonce)

  const allowedOrigins = new Set<string>()
  const selfOrigin = safeOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (selfOrigin) allowedOrigins.add(selfOrigin)
  const asapOrigin = safeOrigin(process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL)
  if (asapOrigin) allowedOrigins.add(asapOrigin)

  const requestOrigin = request.headers.get("origin")
  const requestOriginNormalized = safeOrigin(requestOrigin)

  // For /api routes, reject non-allowlisted cross-origin requests
  if (request.nextUrl.pathname.startsWith("/api")) {
    if (ratelimit && !isE2ERateLimitBypass()) {
      const clientId = getRateLimitClientId(request)
      const { success, limit, reset, remaining } = await ratelimit.limit(clientId)

      if (!success) {
        return withCsp(
          new NextResponse("Too Many Requests", {
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }),
          nonce,
        )
      }
    }

    const isLocalhostDev =
      process.env.NODE_ENV === "development" &&
      requestOriginNormalized !== null &&
      requestOriginNormalized.startsWith("http://localhost")

    const isAllowedOrigin =
      !requestOrigin ||
      (requestOriginNormalized !== null && allowedOrigins.has(requestOriginNormalized)) ||
      isLocalhostDev

    if (!isAllowedOrigin) {
      return withCsp(new NextResponse("Forbidden", { status: 403 }), nonce)
    }

    const allowOrigin =
      (requestOriginNormalized && allowedOrigins.has(requestOriginNormalized)) || isLocalhostDev
        ? requestOriginNormalized!
        : selfOrigin
    const responseHeaders: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    }
    if (allowOrigin) {
      responseHeaders["Access-Control-Allow-Origin"] = allowOrigin
    }

    if (request.method === "OPTIONS") {
      return withCsp(NextResponse.json({}, { headers: responseHeaders }), nonce)
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    Object.entries(responseHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return withCsp(response, nonce)
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp)$).*)",
  ],
}
