"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  Connection as ReactFlowConnection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  XYPosition,
} from "@xyflow/react"
import type { NodeType, Position, Workflow } from "@/lib/workflow-types"
import { reactFlowEdgesToConnections } from "@/lib/builder/workflow-to-reactflow"
import type { WorkflowNodeData } from "../canvas-node"
import { GRID_SIZE, type SafeFetch } from "../builder-constants"

type ToastFn = (props: {
  title: string
  description?: string
  variant?: "default" | "destructive"
}) => void

export function useBuilderGraphMutations(options: {
  workflowId: string | null
  workflow: Workflow | null | undefined
  edges: Edge[]
  saveToHistory: () => void
  mutateWorkflow: (id: string) => void
  safeFetch: SafeFetch
  toast: ToastFn
  screenToFlowPosition: (position: XYPosition) => XYPosition
  onNodesChange: (changes: NodeChange<Node<WorkflowNodeData, NodeType>>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
}) {
  const {
    workflowId,
    workflow,
    edges,
    saveToHistory,
    mutateWorkflow,
    safeFetch,
    toast,
    screenToFlowPosition,
    onNodesChange,
    onEdgesChange,
  } = options

  const layoutTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false)

  useEffect(() => {
    return () => {
      if (layoutTransitionTimeoutRef.current) {
        clearTimeout(layoutTransitionTimeoutRef.current)
        layoutTransitionTimeoutRef.current = null
      }
    }
  }, [])

  const handleNodeDeleteById = useCallback(
    async (nodeId: string) => {
      if (!workflowId) return
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, { method: "DELETE" })
      mutateWorkflow(workflowId)
    },
    [workflowId, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleAssignToFrame = useCallback(
    async (nodeId: string, frameId: string) => {
      if (!workflowId) return
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: frameId }),
      })
      mutateWorkflow(workflowId)
      toast({ title: "Node added to frame" })
    },
    [workflowId, saveToHistory, mutateWorkflow, toast, safeFetch],
  )

  const handleRemoveFromFrame = useCallback(
    async (nodeId: string) => {
      if (!workflowId) return
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: null }),
      })
      mutateWorkflow(workflowId)
      toast({ title: "Node removed from frame" })
    },
    [workflowId, saveToHistory, mutateWorkflow, toast, safeFetch],
  )

  const handleFrameLabelChange = useCallback(
    async (nodeId: string, newLabel: string) => {
      if (!workflowId) return
      const node = workflow?.nodes.find((n) => n.id === nodeId)
      if (!node) return
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...node.data, label: newLabel } }),
      })
      mutateWorkflow(workflowId)
    },
    [workflowId, workflow?.nodes, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<WorkflowNodeData, NodeType>>[]) => {
      onNodesChange(changes)
    },
    [onNodesChange],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)
      const removeChanges = changes.filter((c) => c.type === "remove") as { id: string }[]
      if (removeChanges.length > 0 && workflowId) {
        saveToHistory()
        const updatedEdges = edges.filter((e) => !removeChanges.some((r) => r.id === e.id))
        safeFetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connections: reactFlowEdgesToConnections(updatedEdges) }),
        }).then(() => mutateWorkflow(workflowId))
      }
    },
    [onEdgesChange, edges, workflowId, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleConnect = useCallback(
    async (connection: ReactFlowConnection) => {
      if (!workflowId || !connection.source || !connection.target) return
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: connection.source,
          targetId: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        }),
      })
      mutateWorkflow(workflowId)
    },
    [workflowId, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node<WorkflowNodeData, NodeType>) => {
      if (!workflowId) return
      const snappedPosition = {
        x: Math.round(node.position.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(node.position.y / GRID_SIZE) * GRID_SIZE,
      }
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: snappedPosition }),
      })
      mutateWorkflow(workflowId)
    },
    [workflowId, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleAddNode = useCallback(
    async (type: NodeType, position?: Position) => {
      if (!workflowId) return
      saveToHistory()

      let posX: number
      let posY: number

      if (position) {
        posX = Math.round(position.x / GRID_SIZE) * GRID_SIZE
        posY = Math.round(position.y / GRID_SIZE) * GRID_SIZE
      } else {
        const center = screenToFlowPosition({
          x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
          y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
        })
        posX = Math.round(center.x / GRID_SIZE) * GRID_SIZE
        posY = Math.round(center.y / GRID_SIZE) * GRID_SIZE
      }

      while (
        workflow?.nodes.some(
          (n) => Math.abs(n.position.x - posX) < 10 && Math.abs(n.position.y - posY) < 10,
        )
      ) {
        posX += GRID_SIZE * 2
        posY += GRID_SIZE * 2
      }

      const finalPosition = { x: posX, y: posY }
      const labels: Record<NodeType, string> = {
        start: "Start",
        end: "End",
        agent: "New Agent",
        guardrail: "Guardrail",
        condition: "Condition",
        mcp: "MCP Server",
        "user-approval": "User Approval",
        "file-search": "File Search",
        frame: "New Frame",
      }

      const nodePayload: Record<string, unknown> = {
        type,
        position: finalPosition,
        data: { label: labels[type] },
      }
      if (type === "frame") {
        nodePayload.data = { label: labels[type], width: 400, height: 300 }
        nodePayload.style = { width: 400, height: 300 }
      }

      await safeFetch(`/api/workflows/${workflowId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodePayload),
      })
      mutateWorkflow(workflowId)
    },
    [workflowId, workflow?.nodes, saveToHistory, mutateWorkflow, screenToFlowPosition, safeFetch],
  )

  const handleAddFrame = useCallback(() => {
    handleAddNode("frame")
  }, [handleAddNode])

  const handleAutoLayout = useCallback(async () => {
    if (!workflowId) return
    if (layoutTransitionTimeoutRef.current) {
      clearTimeout(layoutTransitionTimeoutRef.current)
      layoutTransitionTimeoutRef.current = null
    }
    saveToHistory()
    setIsLayoutTransitioning(true)
    const response = await safeFetch(`/api/workflows/${workflowId}/auto-layout`, { method: "POST" })
    if (response.ok) {
      mutateWorkflow(workflowId)
      toast({ title: "Layout applied successfully" })
      layoutTransitionTimeoutRef.current = setTimeout(() => {
        layoutTransitionTimeoutRef.current = null
        setIsLayoutTransitioning(false)
      }, 450)
    } else {
      setIsLayoutTransitioning(false)
      toast({ title: "Failed to apply layout", variant: "destructive" })
    }
  }, [workflowId, saveToHistory, mutateWorkflow, toast, safeFetch])

  const handleNodeDelete = useCallback(
    async (selectedNodeId: string | null) => {
      if (!selectedNodeId || !workflowId) return
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/nodes/${selectedNodeId}`, { method: "DELETE" })
      mutateWorkflow(workflowId)
    },
    [workflowId, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleSaveVersion = useCallback(async () => {
    if (!workflowId) return
    await safeFetch(`/api/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Manual save" }),
    })
  }, [workflowId, safeFetch])

  return {
    isLayoutTransitioning,
    handleNodeDeleteById,
    handleAssignToFrame,
    handleRemoveFromFrame,
    handleFrameLabelChange,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleNodeDragStop,
    handleAddNode,
    handleAddFrame,
    handleAutoLayout,
    handleNodeDelete,
    handleSaveVersion,
  }
}
