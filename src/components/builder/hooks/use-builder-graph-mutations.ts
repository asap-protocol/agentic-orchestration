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

type SaveToHistory = (snapshot?: Workflow) => void

export function useBuilderGraphMutations(options: {
  workflowId: string | null
  workflow: Workflow | null | undefined
  edges: Edge[]
  saveToHistory: SaveToHistory
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
  const pendingDragBatchRef = useRef<{
    positions: Map<string, XYPosition>
    previous: Workflow | null
    flushScheduled: boolean
  }>({ positions: new Map(), previous: null, flushScheduled: false })
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
      if (!workflowId || !workflow) return
      const previous = workflow
      const response = await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        saveToHistory(previous)
      }
      mutateWorkflow(workflowId)
    },
    [workflowId, workflow, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleAssignToFrame = useCallback(
    async (nodeId: string, frameId: string) => {
      if (!workflowId || !workflow) return
      const previous = workflow
      const response = await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: frameId }),
      })
      if (!response.ok) {
        mutateWorkflow(workflowId)
        return
      }
      saveToHistory(previous)
      mutateWorkflow(workflowId)
      toast({ title: "Node added to frame" })
    },
    [workflowId, workflow, saveToHistory, mutateWorkflow, toast, safeFetch],
  )

  const handleRemoveFromFrame = useCallback(
    async (nodeId: string) => {
      if (!workflowId || !workflow) return
      const previous = workflow
      const response = await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: null }),
      })
      if (!response.ok) {
        mutateWorkflow(workflowId)
        return
      }
      saveToHistory(previous)
      mutateWorkflow(workflowId)
      toast({ title: "Node removed from frame" })
    },
    [workflowId, workflow, saveToHistory, mutateWorkflow, toast, safeFetch],
  )

  const handleFrameLabelChange = useCallback(
    async (nodeId: string, newLabel: string) => {
      if (!workflowId || !workflow) return
      const node = workflow.nodes.find((n) => n.id === nodeId)
      if (!node) return
      const previous = workflow
      const response = await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...node.data, label: newLabel } }),
      })
      if (response.ok) {
        saveToHistory(previous)
      }
      mutateWorkflow(workflowId)
    },
    [workflowId, workflow, saveToHistory, mutateWorkflow, safeFetch],
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
      if (removeChanges.length > 0 && workflowId && workflow) {
        const previous = workflow
        const updatedEdges = edges.filter((e) => !removeChanges.some((r) => r.id === e.id))
        void safeFetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connections: reactFlowEdgesToConnections(updatedEdges) }),
        }).then((response) => {
          if (response.ok) {
            saveToHistory(previous)
          }
          mutateWorkflow(workflowId)
        })
      }
    },
    [onEdgesChange, edges, workflowId, workflow, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleConnect = useCallback(
    async (connection: ReactFlowConnection) => {
      if (!workflowId || !workflow || !connection.source || !connection.target) return
      const previous = workflow
      const response = await safeFetch(`/api/workflows/${workflowId}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: connection.source,
          targetId: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        }),
      })
      if (response.ok) {
        saveToHistory(previous)
      }
      mutateWorkflow(workflowId)
    },
    [workflowId, workflow, saveToHistory, mutateWorkflow, safeFetch],
  )

  const flushPendingDragPositions = useCallback(async () => {
    const batch = pendingDragBatchRef.current
    batch.flushScheduled = false
    if (!workflowId || !workflow || batch.positions.size === 0) {
      batch.positions.clear()
      batch.previous = null
      return
    }

    const previous = batch.previous ?? workflow
    const positionUpdates = new Map(batch.positions)
    batch.positions.clear()
    batch.previous = null

    const updatedNodes = workflow.nodes.map((node) => {
      const position = positionUpdates.get(node.id)
      return position ? { ...node, position } : node
    })

    const response = await safeFetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: updatedNodes }),
    })
    if (response.ok) {
      saveToHistory(previous)
    }
    mutateWorkflow(workflowId)
  }, [workflowId, workflow, saveToHistory, mutateWorkflow, safeFetch])

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData, NodeType>) => {
      if (!workflowId || !workflow) return
      const snappedPosition = {
        x: Math.round(node.position.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(node.position.y / GRID_SIZE) * GRID_SIZE,
      }
      const batch = pendingDragBatchRef.current
      if (batch.previous === null) {
        batch.previous = workflow
      }
      batch.positions.set(node.id, snappedPosition)
      if (!batch.flushScheduled) {
        batch.flushScheduled = true
        queueMicrotask(() => {
          void flushPendingDragPositions()
        })
      }
    },
    [workflowId, workflow, flushPendingDragPositions],
  )

  const handleAddNode = useCallback(
    async (type: NodeType, position?: Position) => {
      if (!workflowId || !workflow) return
      const previous = workflow

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
        workflow.nodes.some(
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

      const response = await safeFetch(`/api/workflows/${workflowId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodePayload),
      })
      if (response.ok) {
        saveToHistory(previous)
      }
      mutateWorkflow(workflowId)
    },
    [workflowId, workflow, saveToHistory, mutateWorkflow, screenToFlowPosition, safeFetch],
  )

  const handleAddFrame = useCallback(() => {
    handleAddNode("frame")
  }, [handleAddNode])

  const handleAutoLayout = useCallback(async () => {
    if (!workflowId || !workflow) return
    if (layoutTransitionTimeoutRef.current) {
      clearTimeout(layoutTransitionTimeoutRef.current)
      layoutTransitionTimeoutRef.current = null
    }
    const previous = workflow
    setIsLayoutTransitioning(true)
    const response = await safeFetch(`/api/workflows/${workflowId}/auto-layout`, { method: "POST" })
    if (response.ok) {
      saveToHistory(previous)
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
  }, [workflowId, workflow, saveToHistory, mutateWorkflow, toast, safeFetch])

  const handleNodeDelete = useCallback(
    async (nodeIds: string | string[] | null) => {
      const ids = Array.isArray(nodeIds) ? nodeIds : nodeIds ? [nodeIds] : []
      if (!ids.length || !workflowId || !workflow) return
      const previous = workflow
      const results = await Promise.all(
        ids.map((nodeId) =>
          safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, { method: "DELETE" }),
        ),
      )
      if (results.every((response) => response.ok)) {
        saveToHistory(previous)
      }
      mutateWorkflow(workflowId)
    },
    [workflowId, workflow, saveToHistory, mutateWorkflow, safeFetch],
  )

  const handleSaveVersion = useCallback(async () => {
    if (!workflowId) return
    const response = await safeFetch(`/api/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Manual save" }),
    })
    if (response.ok) {
      toast({ title: "Version saved" })
    }
  }, [workflowId, safeFetch, toast])

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
