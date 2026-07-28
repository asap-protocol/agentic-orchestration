import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflow, updateWorkflow } from "@/lib/db/workflows"
import type { WorkflowNode, Connection } from "@/lib/workflow-types"

const OFFSET_X = 50
const OFFSET_Y = 50

/**
 * Paste nodes. Accepts { nodes, connections? } in body (frontend stores clipboard from copy,
 * serverless incompatible with server-side clipboard).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id: workflowId } = await params
  const body = await request.json()
  const nodesToPaste = body?.nodes as WorkflowNode[] | undefined
  const connectionsToPaste = (body?.connections as Connection[]) ?? []

  if (!nodesToPaste?.length) {
    return NextResponse.json({ error: "Nothing to paste" }, { status: 400 })
  }

  const workflow = await getWorkflow(workflowId, result.workspace.id)
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  const idMap = new Map<string, string>()
  const pastedNodes: WorkflowNode[] = nodesToPaste.map((node) => {
    const newId = crypto.randomUUID()
    idMap.set(node.id, newId)
    return {
      ...node,
      id: newId,
      position: {
        x: node.position.x + OFFSET_X,
        y: node.position.y + OFFSET_Y,
      },
    }
  })

  const pastedConnections = connectionsToPaste
    .filter((c) => idMap.has(c.sourceId) && idMap.has(c.targetId))
    .map((c) => ({
      id: crypto.randomUUID(),
      sourceId: idMap.get(c.sourceId)!,
      targetId: idMap.get(c.targetId)!,
      sourceHandle: c.sourceHandle,
      targetHandle: c.targetHandle,
      label: c.label,
    }))

  const updatedNodes = [...workflow.nodes, ...pastedNodes]
  const updatedConnections = [
    ...workflow.connections,
    ...(pastedConnections as typeof workflow.connections),
  ]

  const updated = await updateWorkflow(
    workflowId,
    {
      nodes: updatedNodes,
      connections: updatedConnections,
    },
    result.workspace.id,
  )

  const newNodeIds = pastedNodes.map((n) => n.id)
  return NextResponse.json({ success: true, nodeIds: newNodeIds, workflow: updated })
}
