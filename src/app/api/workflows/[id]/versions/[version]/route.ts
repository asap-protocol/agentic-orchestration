import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { withWorkspace } from "@/lib/api/with-workspace"
import { versionStore } from "@/lib/version-store"

const tagVersionBodySchema = z.object({
  tag: z.string().min(1, "tag must be a non-empty string"),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id, version } = await params
  const versionNumber = Number.parseInt(version, 10)
  if (Number.isNaN(versionNumber)) {
    return NextResponse.json(
      { error: `Invalid version number: expected integer, got ${JSON.stringify(version)}` },
      { status: 400 },
    )
  }

  const versionData = await versionStore.getVersion(id, versionNumber)

  if (!versionData) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 })
  }

  return NextResponse.json(versionData)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id, version } = await params
  const versionNumber = Number.parseInt(version, 10)
  if (Number.isNaN(versionNumber)) {
    return NextResponse.json(
      { error: `Invalid version number: expected integer, got ${JSON.stringify(version)}` },
      { status: 400 },
    )
  }

  const success = await versionStore.deleteVersion(id, versionNumber)

  if (!success) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  try {
    const { id, version } = await params
    const versionNumber = Number.parseInt(version, 10)
    if (Number.isNaN(versionNumber)) {
      return NextResponse.json(
        { error: `Invalid version number: expected integer, got ${JSON.stringify(version)}` },
        { status: 400 },
      )
    }

    const body = tagVersionBodySchema.parse(await request.json())
    const success = await versionStore.tagVersion(id, versionNumber, body.tag)

    if (!success) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
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
