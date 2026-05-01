import type { NextRequest } from "next/server"

/**
 * Resolves a stable client identifier for rate limiting (e.g. Upstash).
 *
 * When `RATE_LIMIT_CLIENT_IP_HEADER` is set, the value of that header is used
 * (first non-empty segment after comma-split and trim). Only set this to a
 * header your **trusted** edge proxy sets or overwrites (e.g. `CF-Connecting-IP`,
 * `True-Client-IP`). If that header is missing or empty, this falls back to
 * `x-forwarded-for` (first hop), then `x-real-ip`, then `"anonymous"`.
 *
 * Without a trusted proxy, clients can spoof `x-forwarded-for` and similar
 * headers; pinning to a header your edge guarantees prevents accidental trust
 * in client-supplied values.
 */
export function getRateLimitClientId(request: NextRequest): string {
  const pinnedName = process.env.RATE_LIMIT_CLIENT_IP_HEADER?.trim()
  if (pinnedName) {
    const raw = request.headers.get(pinnedName)
    if (raw) {
      for (const part of raw.split(",")) {
        const ip = part.trim()
        if (ip) return ip
      }
    }
  }

  const forwarded = request.headers.get("x-forwarded-for")
  const fromForwarded = forwarded?.split(",")[0]?.trim()
  if (fromForwarded) return fromForwarded

  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return "anonymous"
}
