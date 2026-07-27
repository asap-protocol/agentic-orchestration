import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { versionStore } from "@/lib/version-store"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const v1 = Number.parseInt(searchParams.get("v1") || "", 10)
  const v2 = Number.parseInt(searchParams.get("v2") || "", 10)

  if (Number.isNaN(v1) || Number.isNaN(v2)) {
    return NextResponse.json({ error: "Invalid version numbers" }, { status: 400 })
  }

  const comparison = await versionStore.compareVersions(id, v1, v2)

  if (!comparison) {
    return NextResponse.json({ error: "Versions not found" }, { status: 404 })
  }

  return NextResponse.json(comparison)
}
