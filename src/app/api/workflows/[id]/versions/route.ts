import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflow } from "@/lib/db/workflows"
import { versionStore } from "@/lib/version-store"

const createVersionBodySchema = z.object({
  description: z.string().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const versions = await versionStore.getVersions(id)
  return NextResponse.json(versions)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  try {
    const { id } = await params
    const body = createVersionBodySchema.parse(await request.json().catch(() => ({})))
    const workflow = await getWorkflow(id)

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    }

    const version = await versionStore.createVersion(workflow, body.description)
    return NextResponse.json(version)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 },
      )
    }
    console.error("Version creation error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 })
  }
}
