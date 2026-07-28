import { NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { updateWorkflowNode, deleteWorkflowNode } from "@/lib/db/workflows"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id, nodeId } = await params
  const updates = await request.json()

  try {
    const workflow = await updateWorkflowNode(id, nodeId, updates, result.workspace.id)
    const node = workflow.nodes.find((n) => n.id === nodeId)
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 })
    return NextResponse.json(node)
  } catch {
    return NextResponse.json({ error: "Node not found" }, { status: 404 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id, nodeId } = await params

  try {
    await deleteWorkflowNode(id, nodeId, result.workspace.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Node not found" }, { status: 404 })
  }
}
