import type { Session } from "next-auth"

function readEnv(name: string): string | undefined {
  return process.env[name]
}

/**
 * Stub session for local `next dev`, or Playwright (`next start` + PLAYWRIGHT_E2E=1).
 *
 * Important: read `PLAYWRIGHT_E2E` via bracket/index access so Turbopack/Next build does **not**
 * replace it when the variable was unset at compile time (`next build`).
 *
 * Never set `PLAYWRIGHT_E2E` on real deployments.
 */
export function shouldUseStubAuthSession(): boolean {
  return readEnv("PLAYWRIGHT_E2E") === "1" || process.env.NODE_ENV === "development"
}

export function getStubAuthSession(): Session {
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  return {
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Dev User",
      email: "dev@example.com",
      username: "devuser",
    },
    expires,
  } as Session
}
