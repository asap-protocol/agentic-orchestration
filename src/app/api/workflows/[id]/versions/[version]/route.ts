import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseVersionParam } from "@/lib/api/version-param"
import { withWorkspace } from "@/lib/api/with-workspace"
import { versionStore, type VersionWriteResult } from "@/lib/version-store"

const tagVersionBodySchema = z.object({
  tag: z.string().min(1, "tag must be a non-empty string"),
})

function writeResultResponse(result: VersionWriteResult): NextResponse {
  switch (result) {
    case "ok":
      return NextResponse.json({ success: true })
    case "not_found":
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    case "forbidden":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id, version } = await params
  const parsed = parseVersionParam(version)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: `Invalid version number: expected integer, got ${JSON.stringify(version)}` },
      { status: 400 },
    )
  }

  try {
    const versionData = await versionStore.getVersion(id, parsed.value)
    if (!versionData) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }
    return NextResponse.json(versionData)
  } catch (error) {
    console.error("Version get error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to load version" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id, version } = await params
  const parsed = parseVersionParam(version)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: `Invalid version number: expected integer, got ${JSON.stringify(version)}` },
      { status: 400 },
    )
  }

  try {
    const writeResult = await versionStore.deleteVersion(id, parsed.value)
    return writeResultResponse(writeResult)
  } catch (error) {
    console.error("Version delete error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to delete version" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  try {
    const { id, version } = await params
    const parsed = parseVersionParam(version)
    if (!parsed.ok) {
      return NextResponse.json(
        { error: `Invalid version number: expected integer, got ${JSON.stringify(version)}` },
        { status: 400 },
      )
    }

    const body = tagVersionBodySchema.parse(await request.json())
    const writeResult = await versionStore.tagVersion(id, parsed.value, body.tag)
    return writeResultResponse(writeResult)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 },
      )
    }
    console.error("Version tag error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to tag version" }, { status: 500 })
  }
}
