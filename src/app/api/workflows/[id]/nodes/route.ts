import { NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { addWorkflowNode, deleteWorkflowNodes } from "@/lib/db/workflows"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const nodeData = await request.json()

  try {
    const workflow = await addWorkflowNode(id, nodeData, result.workspace.id)
    const newNode = workflow.nodes[workflow.nodes.length - 1]
    return NextResponse.json(newNode)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database Error"
    const status = message.includes("not found") ? 404 : 500
    console.error("[Node Addition Error]:", message)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const body = await request.json()
  const nodeIds = Array.isArray(body?.nodeIds)
    ? body.nodeIds.filter((nodeId: unknown): nodeId is string => typeof nodeId === "string")
    : []

  if (nodeIds.length === 0) {
    return NextResponse.json({ error: "nodeIds must be a non-empty string array" }, { status: 400 })
  }

  try {
    await deleteWorkflowNodes(id, nodeIds, result.workspace.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }
}
