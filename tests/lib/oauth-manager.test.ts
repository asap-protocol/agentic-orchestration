import { afterEach, describe, expect, it, vi } from "vitest"
import {
  OAUTH_PKCE_MAX_AGE_SECONDS,
  oauthManager,
  verifyPkceCookieValue,
} from "@/lib/oauth-manager"

describe("oauth PKCE cookie", () => {
  const authSecret = "test-auth-secret-for-oauth-pkce"

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it("round-trips state via signed cookie", async () => {
    vi.stubEnv("AUTH_SECRET", authSecret)

    const { authUrl, pkceCookieValue } = await oauthManager.generateAuthUrl(
      "github",
      "http://localhost:3000/api/oauth/callback",
    )
    const state = new URL(authUrl).searchParams.get("state")
    expect(state).toBeTruthy()

    const parsed = await verifyPkceCookieValue(pkceCookieValue, state!)
    expect(parsed).not.toBeNull()
    expect(parsed!.connectorId).toBe("github")
    expect(parsed!.redirectUri).toBe("http://localhost:3000/api/oauth/callback")
    expect(parsed!.state).toBe(state)
    expect(parsed!.codeVerifier).toBeTruthy()
  })

  it("rejects expired cookie", async () => {
    vi.stubEnv("AUTH_SECRET", authSecret)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"))

    const { authUrl, pkceCookieValue } = await oauthManager.generateAuthUrl(
      "slack",
      "http://localhost:3000/cb",
    )
    const state = new URL(authUrl).searchParams.get("state")!

    vi.advanceTimersByTime(OAUTH_PKCE_MAX_AGE_SECONDS * 1000 + 1)
    await expect(verifyPkceCookieValue(pkceCookieValue, state)).resolves.toBeNull()
  })

  it("rejects tampered cookie", async () => {
    vi.stubEnv("AUTH_SECRET", authSecret)

    const { authUrl, pkceCookieValue } = await oauthManager.generateAuthUrl(
      "notion",
      "http://localhost:3000/cb",
    )
    const state = new URL(authUrl).searchParams.get("state")!

    const tampered = pkceCookieValue.slice(0, -4) + (pkceCookieValue.endsWith("a") ? "b" : "a")
    await expect(verifyPkceCookieValue(tampered, state)).resolves.toBeNull()
  })

  it("rejects when query state does not match cookie payload", async () => {
    vi.stubEnv("AUTH_SECRET", authSecret)

    const { pkceCookieValue } = await oauthManager.generateAuthUrl(
      "github",
      "http://localhost:3000/cb",
    )
    await expect(verifyPkceCookieValue(pkceCookieValue, "wrong-state")).resolves.toBeNull()
  })
})
