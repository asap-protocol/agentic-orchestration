import { timingSafeEqual } from "node:crypto"

export interface OAuthProvider {
  id: string
  name: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  clientId?: string
  clientSecret?: string
}

export interface OAuthState {
  connectorId: string
  redirectUri: string
  state: string
  codeVerifier?: string
  timestamp: number
}

/** Single cookie holding HMAC-signed PKCE + OAuth metadata (serverless-safe). */
export const OAUTH_PKCE_COOKIE_NAME = "oauth_pkce"

export const OAUTH_PKCE_MAX_AGE_SECONDS = 600

interface PkceCookiePayload {
  state: string
  connectorId: string
  redirectUri: string
  codeVerifier?: string
  timestamp: number
}

/**
 * When AUTH_SECRET is unset in development/test, this deterministic key is used
 * so local OAuth flows still work. It is never used when NODE_ENV === "production".
 */
const DEV_ONLY_OAUTH_SIGNING_KEY = "__oauth_pkce_dev_hmac_v1__"

function getSigningSecret(): string | null {
  const secret = process.env.AUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === "production") return null
  return DEV_ONLY_OAUTH_SIGNING_KEY
}

function requireSigningSecretForIssue(): string {
  const secret = getSigningSecret()
  if (!secret) {
    throw new Error("AUTH_SECRET is required in production to sign OAuth PKCE state cookies")
  }
  return secret
}

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64UrlToUtf8(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
  const pad = b64.length % 4
  if (pad) b64 += "=".repeat(4 - pad)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)!
  return new TextDecoder().decode(bytes)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64UrlToBytes(b64url: string): Uint8Array | null {
  try {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64.length % 4
    if (pad) b64 += "=".repeat(4 - pad)
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)!
    return out
  } catch {
    return null
  }
}

async function hmacSha256Sign(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  return new Uint8Array(sig)
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

async function signPkceCookiePayload(payload: PkceCookiePayload): Promise<string> {
  const secret = requireSigningSecretForIssue()
  const json = JSON.stringify(payload)
  const payloadB64 = utf8ToBase64Url(json)
  const sig = await hmacSha256Sign(payloadB64, secret)
  const sigB64 = bytesToBase64Url(sig)
  return `${payloadB64}.${sigB64}`
}

function isPkcePayload(v: unknown): v is PkceCookiePayload {
  if (v === null || typeof v !== "object") return false
  const o = v as Record<string, unknown>
  return (
    typeof o.state === "string" &&
    typeof o.connectorId === "string" &&
    typeof o.redirectUri === "string" &&
    typeof o.timestamp === "number" &&
    (o.codeVerifier === undefined || typeof o.codeVerifier === "string")
  )
}

export async function verifyPkceCookieValue(
  cookieValue: string | undefined | null,
  stateFromQuery: string,
): Promise<OAuthState | null> {
  if (!cookieValue) return null
  const secret = getSigningSecret()
  if (!secret) return null

  const dot = cookieValue.indexOf(".")
  if (dot === -1) return null
  const payloadB64 = cookieValue.slice(0, dot)
  const sigB64 = cookieValue.slice(dot + 1)
  if (!payloadB64 || !sigB64) return null

  const expectedSig = await hmacSha256Sign(payloadB64, secret)
  const receivedSig = base64UrlToBytes(sigB64)
  if (!receivedSig || !timingSafeEqualBytes(expectedSig, receivedSig)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(base64UrlToUtf8(payloadB64))
  } catch {
    return null
  }
  if (!isPkcePayload(parsed)) return null
  if (parsed.state !== stateFromQuery) return null

  const maxAgeMs = OAUTH_PKCE_MAX_AGE_SECONDS * 1000
  if (Date.now() - parsed.timestamp > maxAgeMs) return null

  return {
    state: parsed.state,
    connectorId: parsed.connectorId,
    redirectUri: parsed.redirectUri,
    codeVerifier: parsed.codeVerifier,
    timestamp: parsed.timestamp,
  }
}

/** Options for Set-Cookie on the authorize response (and for clearing the cookie). */
export function getOAuthPkceCookieSerializationOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_PKCE_MAX_AGE_SECONDS,
  }
}

/** Same path/security flags as issuance; maxAge 0 removes the cookie in the browser. */
export function getOAuthPkceCookieClearOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  }
}

class OAuthManager {
  private providers: Map<string, OAuthProvider> = new Map([
    [
      "google-drive",
      {
        id: "google-drive",
        name: "Google Drive",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/drive.file",
        ],
      },
    ],
    [
      "dropbox",
      {
        id: "dropbox",
        name: "Dropbox",
        authUrl: "https://www.dropbox.com/oauth2/authorize",
        tokenUrl: "https://api.dropboxapi.com/oauth2/token",
        scopes: ["files.content.read", "files.content.write"],
      },
    ],
    [
      "slack",
      {
        id: "slack",
        name: "Slack",
        authUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        scopes: ["chat:write", "channels:read", "users:read"],
      },
    ],
    [
      "notion",
      {
        id: "notion",
        name: "Notion",
        authUrl: "https://api.notion.com/v1/oauth/authorize",
        tokenUrl: "https://api.notion.com/v1/oauth/token",
        scopes: ["read_content", "update_content"],
      },
    ],
    [
      "github",
      {
        id: "github",
        name: "GitHub",
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: ["repo", "read:org", "read:user"],
      },
    ],
  ])

  getProvider(connectorId: string): OAuthProvider | undefined {
    return this.providers.get(connectorId)
  }

  async generateAuthUrl(
    connectorId: string,
    redirectUri: string,
  ): Promise<{ authUrl: string; pkceCookieValue: string }> {
    const provider = this.providers.get(connectorId)
    if (!provider) {
      throw new Error(`Provider ${connectorId} not found`)
    }

    const state = this.generateState()
    const codeVerifier = this.generateCodeVerifier()
    const timestamp = Date.now()

    const payload: PkceCookiePayload = {
      state,
      connectorId,
      redirectUri,
      codeVerifier,
      timestamp,
    }
    const pkceCookieValue = await signPkceCookiePayload(payload)

    const params = new URLSearchParams({
      client_id: provider.clientId || `demo-client-${connectorId}`,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: provider.scopes.join(" "),
      state: state,
      access_type: "offline",
      prompt: "consent",
    })

    if (codeVerifier) {
      const codeChallenge = await this.generateCodeChallenge(codeVerifier)
      params.append("code_challenge", codeChallenge)
      params.append("code_challenge_method", "S256")
    }

    const authUrl = `${provider.authUrl}?${params.toString()}`
    return { authUrl, pkceCookieValue }
  }

  async exchangeCodeForToken(
    code: string,
    oauthState: OAuthState,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    void code
    const provider = this.providers.get(oauthState.connectorId)
    if (!provider) {
      throw new Error("Provider not found")
    }

    return {
      accessToken: `mock_access_token_${Date.now()}`,
      refreshToken: `mock_refresh_token_${Date.now()}`,
      expiresIn: 3600,
    }
  }

  async refreshAccessToken(
    connectorId: string,
    _refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn?: number }> {
    const provider = this.providers.get(connectorId)
    if (!provider) {
      throw new Error("Provider not found")
    }

    return {
      accessToken: `mock_refreshed_token_${Date.now()}`,
      expiresIn: 3600,
    }
  }

  verifyPkceCookie(
    cookieValue: string | undefined | null,
    stateFromQuery: string,
  ): Promise<OAuthState | null> {
    return verifyPkceCookieValue(cookieValue, stateFromQuery)
  }

  private generateState(): string {
    return `state_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const digest = await crypto.subtle.digest("SHA-256", data)
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
  }
}

export const oauthManager = new OAuthManager()
