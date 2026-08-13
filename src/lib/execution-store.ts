import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { WorkflowExecution } from "./workflow-types"

type ExecutionClient = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>

const PROGRESS_DB_STATUSES = ["running", "pending"] as const

function toDbExecutionStatus(
  status: WorkflowExecution["status"],
): "running" | "completed" | "failed" | "pending" {
  switch (status) {
    case "paused":
      return "pending"
    case "running":
      return "running"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    default: {
      const _exhaustive: never = status
      throw new Error(`Unexpected execution status: ${String(_exhaustive)}`)
    }
  }
}

function isProgressDbStatus(status: unknown): boolean {
  return status === "running" || status === "pending"
}

class ExecutionStore {
  async addExecution(workspaceId: string, execution: WorkflowExecution) {
    const supabase = await getSupabaseServerClient()
    if (!supabase) throw new Error("Database connection required")

    const { error } = await supabase.from("workflow_executions").insert({
      id: execution.id,
      workspace_id: workspaceId,
      workflow_id: execution.workflowId,
      status: toDbExecutionStatus(execution.status),
      input:
        typeof execution.input === "string" ? execution.input : JSON.stringify(execution.input),
      result: execution.result,
      steps: {
        context: execution.context,
        logs: execution.logs,
        currentNodeId: execution.currentNodeId,
      },
      started_at: execution.startedAt.toISOString(),
      completed_at: execution.completedAt?.toISOString(),
      error: execution.error,
    })
    if (error) {
      throw new Error(
        `Failed to insert workflow_executions id=${execution.id} workflowId=${execution.workflowId}: ${error.message}`,
      )
    }
  }

  async getExecution(id: string): Promise<WorkflowExecution | undefined> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return undefined

    const { data } = await supabase.from("workflow_executions").select("*").eq("id", id).single()

    if (!data) return undefined
    return this.mapRow(data)
  }

  async getExecutionsByWorkflow(workflowId: string): Promise<WorkflowExecution[]> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return []

    const { data } = await supabase
      .from("workflow_executions")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("started_at", { ascending: false })

    return (data || []).map(this.mapRow)
  }

  async getAllExecutions(workspaceId: string): Promise<WorkflowExecution[]> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return []

    const { data } = await supabase
      .from("workflow_executions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })

    return (data || []).map(this.mapRow)
  }

  async updateExecution(id: string, updates: Partial<WorkflowExecution>) {
    const supabase = await getSupabaseServerClient()
    if (!supabase) throw new Error("Database connection required")

    const payload = await this.buildUpdatePayload(supabase, id, updates)
    if (Object.keys(payload).length === 0) return

    // Progress snapshots are fire-and-forget from /execute. A late "running"
    // PATCH must not match a row that already reached completed/failed.
    let query = supabase.from("workflow_executions").update(payload).eq("id", id)
    if (isProgressDbStatus(payload.status)) {
      query = query.in("status", [...PROGRESS_DB_STATUSES])
    }
    const { error } = await query
    if (error) {
      throw new Error(
        `Failed to update workflow_executions id=${id} keys=${Object.keys(payload).join(",")}: ${error.message}`,
      )
    }
  }

  async deleteExecution(id: string): Promise<boolean> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return false
    const { error } = await supabase.from("workflow_executions").delete().eq("id", id)
    return !error
  }

  private async buildUpdatePayload(
    supabase: ExecutionClient,
    id: string,
    updates: Partial<WorkflowExecution>,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {}
    if (updates.status) payload.status = toDbExecutionStatus(updates.status)
    if (updates.result) payload.result = updates.result
    if (updates.completedAt) payload.completed_at = updates.completedAt.toISOString()
    if (updates.error) payload.error = updates.error
    if (updates.context || updates.logs || updates.currentNodeId) {
      const { data } = await supabase
        .from("workflow_executions")
        .select("steps")
        .eq("id", id)
        .single()
      const steps = data?.steps || {}
      payload.steps = {
        ...steps,
        context: updates.context || steps.context,
        logs: updates.logs || steps.logs,
        currentNodeId: updates.currentNodeId || steps.currentNodeId,
      }
    }
    return payload
  }

  private mapRow(row: {
    id: string
    workflow_id: string
    status: string
    started_at: string
    completed_at: string | null
    steps?: {
      currentNodeId?: string
      context?: WorkflowExecution["context"]
      logs?: WorkflowExecution["logs"]
    }
    input?: unknown
    result?: unknown
    error?: string | null
  }): WorkflowExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: (row.status === "pending" ? "paused" : row.status) as WorkflowExecution["status"],
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      currentNodeId: row.steps?.currentNodeId,
      context: row.steps?.context || { input: "", variables: {}, messages: [] },
      logs: row.steps?.logs || [],
      input: row.input,
      result: row.result,
      steps: row.steps,
      error: row.error ?? undefined,
    }
  }
}

export const executionStore = new ExecutionStore()
