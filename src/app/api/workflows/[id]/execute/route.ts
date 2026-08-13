import { type NextRequest, NextResponse } from "next/server"
import { withWorkspace } from "@/lib/api/with-workspace"
import { getWorkflow } from "@/lib/db/workflows"
import { WorkflowExecutor } from "@/lib/workflow-executor"
import { executionStore } from "@/lib/execution-store"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await withWorkspace()
  if (result.error) return result.error

  try {
    const { id } = await params
    const { input } = await request.json()

    const workflow = await getWorkflow(id, result.workspace.id)

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    }

    const executor = new WorkflowExecutor(workflow, input, (execution) => {
      // Live progress for realtime subscribers. Terminal-status writes are
      // awaited below; in-flight running patches cannot clobber them.
      executionStore.updateExecution(execution.id, execution).catch(console.error)
    })

    await executionStore.addExecution(result.workspace.id, executor.getExecution())
    const execution = await executor.execute()
    await executionStore.updateExecution(execution.id, execution)

    return NextResponse.json(execution)
  } catch (error) {
    console.error(
      "Workflow execution error:",
      error instanceof Error ? error.message : String(error),
    )
    return NextResponse.json({ error: "Failed to execute workflow" }, { status: 500 })
  }
}
