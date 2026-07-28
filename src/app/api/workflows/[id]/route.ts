import { NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/db/workflows"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const workflow = await getWorkflow(id, result.workspace.id)

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  return NextResponse.json(workflow)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const updates = await request.json()
  const workflow = await updateWorkflow(id, updates, result.workspace.id)

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  return NextResponse.json(workflow)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id } = await params
  const deleted = await deleteWorkflow(id, result.workspace.id)

  if (!deleted) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
