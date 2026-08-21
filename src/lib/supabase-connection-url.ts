/**
 * Allowlist for POST /api/setup/test-connection.
 *
 * Caller-supplied URLs used to be passed to supabase-js unchanged, so the
 * route could fetch loopback, RFC1918, link-local, and cloud-metadata hosts.
 */

const HTTPS_PROTOCOL = "https:"
const HTTP_PROTOCOL = "http:"
const SUPABASE_CLOUD_APEX_HOSTS = new Set(["supabase.co", "supabase.net"])
const SUPABASE_CLOUD_SUFFIXES = [".supabase.co", ".supabase.net"] as const

export class DisallowedSupabaseConnectionUrlError extends Error {
  constructor(received: string) {
    super(
      `Supabase URL is not allowed: received ${received}, expected an https URL on supabase.co / supabase.net or an exact origin match of NEXT_PUBLIC_SUPABASE_URL`,
    )
    this.name = "DisallowedSupabaseConnectionUrlError"
  }
}

function parseAbsoluteUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isSupabaseCloudHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (SUPABASE_CLOUD_APEX_HOSTS.has(host)) {
    return true
  }
  return SUPABASE_CLOUD_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

function originFingerprint(url: URL): string {
  const port = url.port || (url.protocol === HTTPS_PROTOCOL ? "443" : "80")
  return `${url.protocol}//${url.hostname.toLowerCase()}:${port}`
}

function configuredSupabaseOriginFingerprint(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) {
    return null
  }
  const parsed = parseAbsoluteUrl(raw)
  if (!parsed) {
    return null
  }
  if (parsed.protocol !== HTTP_PROTOCOL && parsed.protocol !== HTTPS_PROTOCOL) {
    return null
  }
  return originFingerprint(parsed)
}

function isHttpsSupabaseCloudUrl(url: URL): boolean {
  return url.protocol === HTTPS_PROTOCOL && isSupabaseCloudHostname(url.hostname)
}

/**
 * Returns the origin string for `createClient`, or throws.
 *
 * @example
 * assertAllowedSupabaseConnectionUrl("https://abcd.supabase.co")
 */
export function assertAllowedSupabaseConnectionUrl(raw: string): string {
  const parsed = parseAbsoluteUrl(raw)
  if (!parsed) {
    throw new DisallowedSupabaseConnectionUrlError(raw)
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new DisallowedSupabaseConnectionUrlError(raw)
  }
  if (isHttpsSupabaseCloudUrl(parsed)) {
    return parsed.origin
  }
  const configured = configuredSupabaseOriginFingerprint()
  if (configured && originFingerprint(parsed) === configured) {
    return parsed.origin
  }
  throw new DisallowedSupabaseConnectionUrlError(raw)
}
