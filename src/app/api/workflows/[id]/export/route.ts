import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflow } from "@/lib/db/workflows"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  const { id: workflowId } = await params
  const workflow = await getWorkflow(workflowId, result.workspace.id)

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  const jsonData = JSON.stringify(workflow, null, 2)
  const filename = `${workflow.name.replace(/\s+/g, "-").toLowerCase() || "workflow"}.json`

  return new NextResponse(jsonData, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
