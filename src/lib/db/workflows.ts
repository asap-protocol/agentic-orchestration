import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { Workflow, WorkflowNode, Connection } from "@/lib/workflow-types"
import { mapWorkflowRow, mapWorkflowRows, type WorkflowRow } from "./workflow-mapper"

// Strict Supabase configuration enforced

export async function getWorkflows(workspaceId: string): Promise<Workflow[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error("Database connection is required.")
  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })

  if (error) throw error
  return mapWorkflowRows((data ?? []) as WorkflowRow[])
}

export async function getWorkflow(id: string, workspaceId?: string): Promise<Workflow | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error("Database connection is required.")
  let query = supabase.from("workflows").select("*").eq("id", id)
  if (workspaceId) query = query.eq("workspace_id", workspaceId)
  const { data, error } = await query.single()

  if (error || !data) return null
  return mapWorkflowRow(data as WorkflowRow)
}

export async function createWorkflow(
  workspaceId: string,
  workflow: Omit<Workflow, "id" | "version" | "createdAt" | "updatedAt">,
): Promise<Workflow> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error("Database connection is required to create a workflow.")

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      workspace_id: workspaceId,
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      connections: workflow.connections,
    })
    .select()
    .single()

  if (error) throw error
  return mapWorkflowRow(data as WorkflowRow)
}

export async function updateWorkflow(
  id: string,
  updates: Partial<Workflow>,
  workspaceId?: string,
): Promise<Workflow> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error("Database connection is required to update a workflow.")

  const payload: Record<string, unknown> = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.nodes !== undefined) payload.nodes = updates.nodes
  if (updates.connections !== undefined) payload.connections = updates.connections

  let query = supabase.from("workflows").update(payload).eq("id", id)
  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId)
  }

  const { data, error } = await query.select().single()

  if (error) throw error
  return mapWorkflowRow(data as WorkflowRow)
}

export async function deleteWorkflow(id: string, workspaceId?: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error("Database connection is required to delete a workflow.")

  let query = supabase.from("workflows").delete().eq("id", id)
  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId)
  }

  const { error } = await query

  return !error
}

export async function addWorkflowNode(
  workflowId: string,
  node: Omit<WorkflowNode, "id">,
  workspaceId?: string,
): Promise<Workflow> {
  const workflow = await getWorkflow(workflowId, workspaceId)
  if (!workflow) throw new Error("Workflow not found")

  const newNode: WorkflowNode = { ...node, id: crypto.randomUUID() }
  const updatedNodes = [...workflow.nodes, newNode]

  return await updateWorkflow(workflowId, { nodes: updatedNodes }, workspaceId)
}

export async function updateWorkflowNode(
  workflowId: string,
  nodeId: string,
  updates: Partial<WorkflowNode>,
  workspaceId?: string,
): Promise<Workflow> {
  const workflow = await getWorkflow(workflowId, workspaceId)
  if (!workflow) throw new Error("Workflow not found")

  const updatedNodes = workflow.nodes.map((node) => {
    if (node.id !== nodeId) return node
    const merged = { ...node, ...updates }
    if (updates.parentId === null) delete merged.parentId
    return merged
  })

  return await updateWorkflow(workflowId, { nodes: updatedNodes }, workspaceId)
}

export async function deleteWorkflowNodes(
  workflowId: string,
  nodeIds: string[],
  workspaceId?: string,
): Promise<Workflow> {
  if (nodeIds.length === 0) {
    throw new Error("At least one node id is required")
  }

  const workflow = await getWorkflow(workflowId, workspaceId)
  if (!workflow) throw new Error("Workflow not found")

  const nodeIdsSet = new Set(nodeIds)
  const updatedNodes = workflow.nodes.filter((node) => !nodeIdsSet.has(node.id))
  const updatedConnections = workflow.connections.filter(
    (conn) => !nodeIdsSet.has(conn.sourceId) && !nodeIdsSet.has(conn.targetId),
  )

  return await updateWorkflow(
    workflowId,
    { nodes: updatedNodes, connections: updatedConnections },
    workspaceId,
  )
}

export async function deleteWorkflowNode(
  workflowId: string,
  nodeId: string,
  workspaceId?: string,
): Promise<Workflow> {
  return deleteWorkflowNodes(workflowId, [nodeId], workspaceId)
}

export async function addWorkflowConnection(
  workflowId: string,
  connection: Omit<Connection, "id">,
  workspaceId?: string,
): Promise<Workflow> {
  const workflow = await getWorkflow(workflowId, workspaceId)
  if (!workflow) throw new Error("Workflow not found")

  const exists = workflow.connections.some(
    (c) => c.sourceId === connection.sourceId && c.targetId === connection.targetId,
  )
  if (exists) throw new Error("Connection already exists")

  const newConnection: Connection = { ...connection, id: crypto.randomUUID() }
  const updatedConnections = [...workflow.connections, newConnection]

  return await updateWorkflow(workflowId, { connections: updatedConnections }, workspaceId)
}

export async function deleteWorkflowConnection(
  workflowId: string,
  connectionId: string,
  workspaceId?: string,
): Promise<Workflow> {
  const workflow = await getWorkflow(workflowId, workspaceId)
  if (!workflow) throw new Error("Workflow not found")

  const updatedConnections = workflow.connections.filter((conn) => conn.id !== connectionId)

  return await updateWorkflow(workflowId, { connections: updatedConnections }, workspaceId)
}
