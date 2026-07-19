"use client"

import type { ReactNode } from "react"
import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"

/**
 * Hydrates client `useSession` from the App Router session returned by `await auth()` (see root layout).
 * Required for Playwright/E2E: without this, SSR can see the stub session while the client stays unauthenticated.
 */
export function AuthProvider({
  children,
  session,
}: {
  children: ReactNode
  session: Session | null
}) {
  return <SessionProvider session={session ?? undefined}>{children}</SessionProvider>
}
