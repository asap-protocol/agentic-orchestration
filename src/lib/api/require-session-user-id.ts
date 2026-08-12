import { NextResponse } from "next/server"

/**
 * Require an authenticated session with a non-empty user id.
 * Callers must not trust client-supplied owner ids for connection ownership.
 */
export function requireSessionUserId(
  session: { user?: { id?: string | null } } | null,
): string | NextResponse {
  const userId = session?.user?.id
  if (!session || typeof userId !== "string" || userId.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return userId
}
