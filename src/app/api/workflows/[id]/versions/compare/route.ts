import { type NextRequest, NextResponse } from "next/server"
import { parseVersionParam } from "@/lib/api/version-param"
import { withWorkspace } from "@/lib/api/with-workspace"
import { versionStore } from "@/lib/version-store"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const v1Raw = searchParams.get("v1") || ""
  const v2Raw = searchParams.get("v2") || ""
  const v1 = parseVersionParam(v1Raw)
  const v2 = parseVersionParam(v2Raw)

  if (!v1.ok || !v2.ok) {
    return NextResponse.json({ error: "Invalid version numbers" }, { status: 400 })
  }

  try {
    const comparison = await versionStore.compareVersions(id, v1.value, v2.value)
    if (!comparison) {
      return NextResponse.json({ error: "Versions not found" }, { status: 404 })
    }
    return NextResponse.json(comparison)
  } catch (error) {
    console.error("Version compare error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to compare versions" }, { status: 500 })
  }
}
