/**
 * Validates redirect URLs against an allowlist of trusted origins.
 *
 * Security: only absolute URLs whose origin EXACTLY matches `baseUrl` (or the
 * optional `asapUrl`) are returned as-is. Any other input — relative paths,
 * non-http(s) schemes, malformed URLs, and prefix-spoofing attempts such as
 * `https://baseUrl.attacker.com/...` — falls back to `baseUrl`. This prevents
 * open-redirect vulnerabilities in the OAuth/ASAP Protocol flows.
 *
 * @param url - The redirect URL to validate
 * @param baseUrl - The primary trusted base URL (also the safe fallback)
 * @param asapUrl - Optional ASAP Protocol base URL to also trust
 * @returns The validated URL when its origin is allowlisted; otherwise baseUrl
 */
export function resolveRedirectUrl(url: string, baseUrl: string, asapUrl?: string): string {
  const allowedOrigins = new Set<string>()
  const baseOrigin = safeOrigin(baseUrl)
  if (baseOrigin) allowedOrigins.add(baseOrigin)
  if (asapUrl) {
    const asapOrigin = safeOrigin(asapUrl)
    if (asapOrigin) allowedOrigins.add(asapOrigin)
  }

  const candidateOrigin = safeOrigin(url)
  if (candidateOrigin && allowedOrigins.has(candidateOrigin)) {
    return url
  }

  return baseUrl
}

function safeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.origin
  } catch {
    return null
  }
}
