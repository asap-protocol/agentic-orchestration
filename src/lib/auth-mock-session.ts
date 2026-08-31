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
 * Double guard: never activate in `NODE_ENV=production`, even if `PLAYWRIGHT_E2E=1` is
 * accidentally set on a real deployment (restores the PR #15 production guard lost in
 * the Turbopack stub-extraction refactor). Playwright sets `NODE_ENV=test` + `PLAYWRIGHT_E2E=1`.
 */
export function shouldUseStubAuthSession(): boolean {
  if (process.env.NODE_ENV === "production") return false
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
