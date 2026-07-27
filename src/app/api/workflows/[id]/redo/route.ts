// Deprecated; use client HistoryManager for undo/redo (Builder Hardening Sprint 0).
import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  return NextResponse.json(
    {
      error:
        "This redo endpoint is gone (410). Undo/redo are client-only via HistoryManager (Builder Hardening Sprint 0).",
    },
    { status: 410 },
  )
}
