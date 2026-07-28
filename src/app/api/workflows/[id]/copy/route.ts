import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflow } from "@/lib/db/workflows"

/**
 * Copy selected nodes. Returns nodes in response for frontend to store in clipboard
 * (serverless incompatible with server-side clipboard).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id: workflowId } = await params
  const { nodeIds } = await request.json()

  const workflow = await getWorkflow(workflowId, result.workspace.id)
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  const nodeIdsSet = new Set((nodeIds as string[]) ?? [])
  const nodes = workflow.nodes.filter((n) => nodeIdsSet.has(n.id))
  const connections = workflow.connections.filter(
    (c) => nodeIdsSet.has(c.sourceId) && nodeIdsSet.has(c.targetId),
  )

  return NextResponse.json({ success: true, count: nodes.length, nodes, connections })
}
