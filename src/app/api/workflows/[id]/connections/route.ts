import { NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { addWorkflowConnection } from "@/lib/db/workflows"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const connectionData = await request.json()

  try {
    const workflow = await addWorkflowConnection(id, connectionData, result.workspace.id)
    const newConnection = workflow.connections[workflow.connections.length - 1]
    return NextResponse.json(newConnection)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add connection"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
