import { NextResponse } from "next/server"
import { getCurrentWorkspace } from "@/lib/db/workspaces"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const workspace = await getCurrentWorkspace()
    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(workspace)
  } catch (err) {
    console.error("GET /api/workspaces error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 })
  }
}
