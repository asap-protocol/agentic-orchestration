import type { Node, Edge } from "@xyflow/react"
import type { WorkflowNode, Connection, NodeData, NodeType } from "@/lib/workflow-types"
import { NODE_COLORS_HEX } from "@/lib/workflow-types"

export type WorkflowNodeType = WorkflowNode["type"]

const NODE_TYPES: NodeType[] = [
  "agent",
  "start",
  "end",
  "guardrail",
  "condition",
  "mcp",
  "user-approval",
  "file-search",
  "frame",
]

function toNodeType(value: string | undefined): NodeType {
  if (value != null && NODE_TYPES.includes(value as NodeType)) return value as NodeType
  return "agent"
}

export function workflowNodesToReactFlow(
  nodes: WorkflowNode[],
): Node<NodeData, WorkflowNodeType>[] {
  return (nodes || []).map((n) => {
    const base = {
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      selected: n.selected,
    }
    if (n.parentId) {
      return { ...base, parentId: n.parentId, extent: "parent" as const }
    }
    if (n.type === "frame" && n.style) {
      return { ...base, style: { width: n.style.width ?? 400, height: n.style.height ?? 300 } }
    }
    return base
  })
}

export interface WorkflowConnectionsToEdgesOptions {
  nodes?: WorkflowNode[]
  runningEdgeIds?: string[]
}

/**
 * Connection ids that touch a node (as source or target). Used for run-edge highlight.
 *
 * @example
 * connectionIdsTouchingNode(connections, "n2") // ["e1", "e2"]
 */
export function connectionIdsTouchingNode(connections: Connection[], nodeId: string): string[] {
  return (connections || [])
    .filter((c) => c.sourceId === nodeId || c.targetId === nodeId)
    .map((c) => c.id)
}

export function workflowConnectionsToEdges(
  connections: Connection[],
  options: WorkflowConnectionsToEdgesOptions = {},
): Edge[] {
  const { nodes = [], runningEdgeIds = [] } = options
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (connections || []).map((c) => {
    const sourceNode = nodeMap.get(c.sourceId)
    const targetNode = nodeMap.get(c.targetId)
    const sourceType = toNodeType(sourceNode?.type)
    const targetType = toNodeType(targetNode?.type)
    const sourceColor = NODE_COLORS_HEX[sourceType] ?? "#3b82f6"
    const targetColor = NODE_COLORS_HEX[targetType] ?? "#94a3b8"
    const isRunning = runningEdgeIds.includes(c.id)

    return {
      id: c.id,
      source: c.sourceId,
      target: c.targetId,
      sourceHandle: c.sourceHandle ?? "output",
      targetHandle: c.targetHandle ?? "input",
      type: isRunning ? "animatedFlow" : "gradient",
      data: { sourceColor, targetColor, isRunning },
    }
  })
}

export function reactFlowNodesToWorkflow(
  nodes: Node<NodeData, WorkflowNodeType>[],
): WorkflowNode[] {
  return (nodes || []).map((n) => {
    const base: WorkflowNode = {
      id: n.id,
      type: n.type as WorkflowNode["type"],
      position: n.position,
      data: n.data as NodeData,
      selected: n.selected,
    }
    if (n.parentId) base.parentId = n.parentId
    if (n.type === "frame" && n.style) {
      base.style = {
        width: typeof n.style.width === "number" ? n.style.width : undefined,
        height: typeof n.style.height === "number" ? n.style.height : undefined,
      }
    }
    return base
  })
}

export function reactFlowEdgesToConnections(edges: Edge[]): Connection[] {
  return (edges || []).map((e) => ({
    id: e.id,
    sourceId: e.source,
    targetId: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }))
}
