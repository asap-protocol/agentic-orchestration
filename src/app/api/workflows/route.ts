import { NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflows, createWorkflow } from "@/lib/db/workflows"

export const dynamic = "force-dynamic"

export async function GET() {
  const result = await withWorkspace()
  if (result.error) return result.error

  try {
    const workflows = await getWorkflows(result.workspace.id)
    return NextResponse.json(workflows)
  } catch (err) {
    console.error("GET /api/workflows error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "Failed to load workflows" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const data = await request.json()
  const workflow = await createWorkflow(result.workspace.id, {
    name: data.name ?? "Untitled Workflow",
    description: data.description ?? "",
    nodes: data.nodes ?? [],
    connections: data.connections ?? [],
  })
  return NextResponse.json(workflow)
}
