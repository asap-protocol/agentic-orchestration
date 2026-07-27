// Deprecated; use client HistoryManager for history status (Builder Hardening Sprint 0).
import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"

export async function GET(_request: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  return NextResponse.json(
    {
      error:
        "This history status endpoint is gone (410). Undo/redo/history status are client-only via HistoryManager (Builder Hardening Sprint 0).",
    },
    { status: 410 },
  )
}
