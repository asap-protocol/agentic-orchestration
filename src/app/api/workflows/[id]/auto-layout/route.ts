import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflow, updateWorkflow } from "@/lib/db/workflows"
import { autoLayout } from "@/lib/auto-layout"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id: workflowId } = await params
  const workflow = await getWorkflow(workflowId, result.workspace.id)

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  const layoutedNodes = autoLayout.applyLayout(workflow.nodes, workflow.connections)
  const updated = await updateWorkflow(workflowId, { nodes: layoutedNodes }, result.workspace.id)

  return NextResponse.json(updated)
}
