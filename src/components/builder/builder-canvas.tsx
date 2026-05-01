"use client"

import type React from "react"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type NodeChange,
  type EdgeChange,
  type Connection as ReactFlowConnection,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  Play,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Undo,
  Redo,
  History,
  ArrowDownUp,
  LogIn,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { WorkflowNode, Position, NodeType, Workflow, Connection } from "@/lib/workflow-types"
import { NodeSidebar } from "./node-sidebar"
import { CanvasNode } from "./canvas-node"
import { FrameNode } from "./frame-node"
import { NodePropertiesPanel } from "./node-properties-panel"
import useSWR, { mutate } from "swr"
import { ExecutionMonitor } from "./execution-monitor"
import { VersionHistoryPanel } from "./version-history-panel"
import { ExportImportDialog } from "./export-import-dialog"
import { BuilderCommandPalette } from "./builder-command-palette"
import { NodeContextMenu, PaneContextMenu } from "./builder-context-menu"
import { GlassContainer } from "@/components/ui/glass-container"
import { getHistoryManager } from "@/lib/history-manager"
import { useToast } from "@/hooks/use-toast"
import {
  workflowNodesToReactFlow,
  workflowConnectionsToEdges,
  reactFlowEdgesToConnections,
} from "@/lib/builder/workflow-to-reactflow"
import { edgeTypes } from "./edges"
import type { WorkflowNodeData, WorkflowNodeProps } from "./canvas-node"
import type { FrameNodeData } from "./frame-node"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const GRID_SIZE = 20
const NODE_TYPES = [
  "agent",
  "start",
  "end",
  "guardrail",
  "condition",
  "mcp",
  "user-approval",
  "file-search",
  "frame",
] as const

function BuilderCanvasInner() {
  const clipboardRef = useRef<{ nodes: WorkflowNode[]; connections: Connection[] } | null>(null)
  const layoutTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast } = useToast()
  const { screenToFlowPosition, getViewport } = useReactFlow()

  const safeFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      const res = await fetch(url, options)
      if (!res.ok) {
        let msg = "Operation failed"
        try {
          msg = (await res.clone().json()).error || msg
        } catch {
          /* ignore JSON parsing errors */
        }
        toast({ title: "Database Error", description: msg, variant: "destructive" })
      }
      return res
    },
    [toast],
  )

  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [creationFailed, setCreationFailed] = useState(false)

  const {
    data: workflows,
    isLoading: isLoadingWorkflows,
    error: workflowsError,
  } = useSWR<Workflow[]>("/api/workflows", fetcher, { revalidateOnFocus: false })

  const isUnauthorized = workflowsError?.message === "UNAUTHORIZED"

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isLoadingWorkflows || isUnauthorized) return
    if (workflows && Array.isArray(workflows)) {
      if (workflows.length === 0 && !workflowId && !creationFailed) {
        safeFetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Untitled Workflow",
            description: "",
            nodes: [],
            connections: [],
          }),
        })
          .then((res) => res.json())
          .then((created) => {
            if (created?.id) {
              setWorkflowId(created.id)
              mutate("/api/workflows")
            } else {
              setCreationFailed(true)
            }
          })
          .catch((err) => {
            console.error("Failed to default create workflow:", err)
            setCreationFailed(true)
          })
      } else if (workflows.length > 0 && !workflowId) {
        setWorkflowId(workflows[0].id)
      }
    }
  }, [workflows, isLoadingWorkflows, isUnauthorized, workflowId, creationFailed, safeFetch])
  /* eslint-enable react-hooks/set-state-in-effect */

  const { data: workflow, isLoading } = useSWR<Workflow | null>(
    workflowId ? `/api/workflows/${workflowId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )
  const { data: historyStatus } = useSWR<{ canUndo: boolean; canRedo: boolean } | null>(
    workflowId ? `/api/workflows/${workflowId}/history/status` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const [showSidebar, setShowSidebar] = useState(true)
  const [showProperties, setShowProperties] = useState(true)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showExecutionMonitor, setShowExecutionMonitor] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [highlightedEdgeIds, _setHighlightedEdgeIds] = useState<string[]>([])
  const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false)

  const saveToHistory = useCallback(() => {
    if (workflow && workflowId) {
      const historyManager = getHistoryManager(workflowId)
      historyManager.saveState(workflow)
    }
  }, [workflow, workflowId])

  const mutateWorkflowAndHistory = useCallback((id: string) => {
    mutate(`/api/workflows/${id}`)
    mutate(`/api/workflows/${id}/history/status`)
  }, [])

  const [menuType, setMenuType] = useState<"node" | "pane" | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null)

  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setMenuType("pane")
    if ("clientX" in event) {
      setMenuPosition({ x: event.clientX, y: event.clientY })
    }
    setMenuNodeId(null)
  }, [])

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    event.stopPropagation()
    setMenuType("node")
    setMenuPosition({ x: event.clientX, y: event.clientY })
    setMenuNodeId(node.id)
  }, [])

  const handleCloseMenu = useCallback(() => {
    setMenuType(null)
    setMenuPosition(null)
    setMenuNodeId(null)
  }, [])

  const handleNodeDeleteById = useCallback(
    async (nodeId: string) => {
      if (!workflowId) return
      saveToHistory()
      await safeFetch(`/api/workflows/${workflowId}/nodes/${nodeId}`, { method: "DELETE" })
      mutateWorkflowAndHistory(workflowId)
    },
    [workflowId, saveToHistory, mutateWorkflowAndHistory, safeFetch],
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
      mutateWorkflowAndHistory(workflowId)
      toast({ title: "Node added to frame" })
    },
    [workflowId, saveToHistory, mutateWorkflowAndHistory, toast, safeFetch],
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
      mutateWorkflowAndHistory(workflowId)
      toast({ title: "Node removed from frame" })
    },
    [workflowId, saveToHistory, mutateWorkflowAndHistory, toast, safeFetch],
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
      mutateWorkflowAndHistory(workflowId)
    },
    [workflowId, workflow?.nodes, saveToHistory, mutateWorkflowAndHistory, safeFetch],
  )

  const initialNodes = workflow
    ? workflowNodesToReactFlow(workflow.nodes).map((n) => ({
        ...n,
        data: {
          ...n.data,
          isHighlighted: n.id === highlightedNodeId,
          customOnDelete: () => handleNodeDeleteById(n.id),
        } as WorkflowNodeData & { customOnDelete?: () => void },
      }))
    : []
  const initialEdges = workflow
    ? workflowConnectionsToEdges(workflow.connections, {
        nodes: workflow.nodes,
        runningEdgeIds: highlightedEdgeIds,
      })
    : []

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    if (workflow) {
      let flowNodes = workflowNodesToReactFlow(workflow.nodes).map((n) => ({
        ...n,
        data: {
          ...n.data,
          isHighlighted: n.id === highlightedNodeId,
          customOnDelete: () => handleNodeDeleteById(n.id),
          ...(n.type === "frame" && {
            customOnLabelChange: (newLabel: string) => handleFrameLabelChange(n.id, newLabel),
          }),
        } as WorkflowNodeData & {
          customOnDelete?: () => void
          customOnLabelChange?: (l: string) => void
        },
      }))
      if (isLayoutTransitioning) {
        flowNodes = flowNodes.map((n) => ({
          ...n,
          style: {
            ...n.style,
            transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          },
        }))
      }
      setNodes(flowNodes)
      setEdges(
        workflowConnectionsToEdges(workflow.connections, {
          nodes: workflow.nodes,
          runningEdgeIds: highlightedEdgeIds,
        }),
      )
    }
  }, [
    workflow,
    highlightedNodeId,
    highlightedEdgeIds,
    isLayoutTransitioning,
    handleNodeDeleteById,
    handleFrameLabelChange,
    setNodes,
    setEdges,
  ])

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
        }).then(() => mutateWorkflowAndHistory(workflowId!))
      }
    },
    [onEdgesChange, edges, workflowId, saveToHistory, mutateWorkflowAndHistory, safeFetch],
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
      mutateWorkflowAndHistory(workflowId)
    },
    [workflowId, saveToHistory, mutateWorkflowAndHistory, safeFetch],
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
      mutateWorkflowAndHistory(workflowId)
    },
    [workflowId, saveToHistory, mutateWorkflowAndHistory, safeFetch],
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
      mutateWorkflowAndHistory(workflowId)
    },
    [
      workflowId,
      workflow?.nodes,
      saveToHistory,
      mutateWorkflowAndHistory,
      screenToFlowPosition,
      safeFetch,
    ],
  )

  const handleAddFrame = useCallback(() => {
    handleAddNode("frame")
  }, [handleAddNode])

  const selectedNodeId = nodes.find((n) => n.selected)?.id ?? null
  const selectedNode = workflow?.nodes?.find((n) => n.id === selectedNodeId)

  const handleUndo = useCallback(async () => {
    if (!workflowId) return
    await safeFetch(`/api/workflows/${workflowId}/undo`, { method: "POST" })
    mutateWorkflowAndHistory(workflowId)
  }, [workflowId, mutateWorkflowAndHistory, safeFetch])

  const handleRedo = useCallback(async () => {
    if (!workflowId) return
    await safeFetch(`/api/workflows/${workflowId}/redo`, { method: "POST" })
    mutateWorkflowAndHistory(workflowId)
  }, [workflowId, mutateWorkflowAndHistory, safeFetch])

  const handleCopy = useCallback(async () => {
    if (!selectedNodeId || !workflowId) return
    const response = await safeFetch(`/api/workflows/${workflowId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeIds: [selectedNodeId] }),
    })
    if (response.ok) {
      const result = await response.json()
      clipboardRef.current = { nodes: result.nodes ?? [], connections: result.connections ?? [] }
      toast({ title: "Node copied to clipboard" })
    }
  }, [selectedNodeId, workflowId, toast, safeFetch])

  const handlePaste = useCallback(async () => {
    if (!workflowId) return
    const clipboard = clipboardRef.current
    if (!clipboard?.nodes?.length) {
      toast({ title: "Nothing to paste", variant: "destructive" })
      return
    }
    saveToHistory()
    const response = await safeFetch(`/api/workflows/${workflowId}/paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: clipboard.nodes, connections: clipboard.connections }),
    })
    if (response.ok) {
      const result = await response.json()
      mutateWorkflowAndHistory(workflowId)
      toast({ title: `Pasted ${result.nodeIds?.length ?? 0} node(s)` })
    } else {
      toast({ title: "Nothing to paste", variant: "destructive" })
    }
  }, [workflowId, saveToHistory, mutateWorkflowAndHistory, toast, safeFetch])

  const handleDuplicate = useCallback(async () => {
    if (!selectedNodeId || !workflowId) return
    saveToHistory()
    const copyRes = await safeFetch(`/api/workflows/${workflowId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeIds: [selectedNodeId] }),
    })
    if (!copyRes.ok) return
    const copyResult = await copyRes.json()
    clipboardRef.current = {
      nodes: copyResult.nodes ?? [],
      connections: copyResult.connections ?? [],
    }
    const pasteRes = await safeFetch(`/api/workflows/${workflowId}/paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: copyResult.nodes ?? [],
        connections: copyResult.connections ?? [],
      }),
    })
    if (pasteRes.ok) {
      mutateWorkflowAndHistory(workflowId)
      toast({ title: "Node duplicated" })
    }
  }, [selectedNodeId, workflowId, saveToHistory, mutateWorkflowAndHistory, toast, safeFetch])

  const handleSelectAll = useCallback(() => {
    if (workflow?.nodes.length) {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === workflow.nodes[0].id })))
    }
  }, [workflow, setNodes])

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
      mutateWorkflowAndHistory(workflowId)
      toast({ title: "Layout applied successfully" })
      layoutTransitionTimeoutRef.current = setTimeout(() => {
        layoutTransitionTimeoutRef.current = null
        setIsLayoutTransitioning(false)
      }, 450)
    } else {
      setIsLayoutTransitioning(false)
      toast({ title: "Failed to apply layout", variant: "destructive" })
    }
  }, [workflowId, saveToHistory, mutateWorkflowAndHistory, toast, safeFetch])

  useEffect(() => {
    return () => {
      if (layoutTransitionTimeoutRef.current) {
        clearTimeout(layoutTransitionTimeoutRef.current)
        layoutTransitionTimeoutRef.current = null
      }
    }
  }, [])

  const handleNodeDelete = useCallback(async () => {
    if (!selectedNodeId || !workflowId) return
    saveToHistory()
    await safeFetch(`/api/workflows/${workflowId}/nodes/${selectedNodeId}`, { method: "DELETE" })
    mutateWorkflowAndHistory(workflowId)
  }, [selectedNodeId, workflowId, saveToHistory, mutateWorkflowAndHistory, safeFetch])

  const handleDuplicateById = useCallback(
    async (nodeId: string) => {
      if (!workflowId) return
      saveToHistory()
      const copyRes = await safeFetch(`/api/workflows/${workflowId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeIds: [nodeId] }),
      })
      if (!copyRes.ok) return
      const copyResult = await copyRes.json()
      const pasteRes = await safeFetch(`/api/workflows/${workflowId}/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: copyResult.nodes ?? [],
          connections: copyResult.connections ?? [],
        }),
      })
      if (pasteRes.ok) {
        mutateWorkflowAndHistory(workflowId)
        toast({ title: "Node duplicated" })
      }
    },
    [workflowId, saveToHistory, mutateWorkflowAndHistory, toast, safeFetch],
  )

  const handleCopyById = useCallback(
    async (nodeId: string) => {
      if (!workflowId) return
      const response = await safeFetch(`/api/workflows/${workflowId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeIds: [nodeId] }),
      })
      if (response.ok) {
        const result = await response.json()
        clipboardRef.current = { nodes: result.nodes ?? [], connections: result.connections ?? [] }
        toast({ title: "Node copied to clipboard" })
      }
    },
    [workflowId, toast, safeFetch],
  )

  const nodeTypes = useMemo(() => {
    return Object.fromEntries(
      NODE_TYPES.map((t) => [t, t === "frame" ? FrameNode : CanvasNode]),
    ) as Record<
      (typeof NODE_TYPES)[number],
      React.ComponentType<WorkflowNodeProps | NodeProps<Node<FrameNodeData, "frame">>>
    >
  }, [])

  const handleSaveVersion = useCallback(async () => {
    if (!workflowId) return
    await safeFetch(`/api/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Manual save" }),
    })
  }, [workflowId, safeFetch])

  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const handleZoomIn = useCallback(() => zoomIn(), [zoomIn])
  const handleZoomOut = useCallback(() => zoomOut(), [zoomOut])
  const handleResetView = useCallback(() => fitView({ padding: 0.2 }), [fitView])

  useEffect(() => {
    const closeMenuOnResizeOrScroll = () => handleCloseMenu()
    window.addEventListener("resize", closeMenuOnResizeOrScroll)
    window.addEventListener("scroll", closeMenuOnResizeOrScroll, true)
    return () => {
      window.removeEventListener("resize", closeMenuOnResizeOrScroll)
      window.removeEventListener("scroll", closeMenuOnResizeOrScroll, true)
    }
  }, [handleCloseMenu])

  useEffect(() => {
    const handleCommandPaletteKey = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      if (isInput) return

      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setCommandPaletteOpen(true)
      } else if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    window.addEventListener("keydown", handleCommandPaletteKey)
    return () => window.removeEventListener("keydown", handleCommandPaletteKey)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      if (isInput) return

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault()
        handleCopy()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault()
        handlePaste()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault()
        handleDuplicate()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        handleSelectAll()
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        e.preventDefault()
        handleNodeDelete()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handleSaveVersion()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "=") {
        e.preventDefault()
        handleZoomIn()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault()
        handleZoomOut()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault()
        handleResetView()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") {
        e.preventDefault()
        handleAutoLayout()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    handleUndo,
    handleRedo,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleSelectAll,
    handleNodeDelete,
    handleSaveVersion,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleAutoLayout,
    selectedNodeId,
  ])

  if (isUnauthorized) {
    return (
      <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
        <LogIn className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground">Sign in to access the workflow builder</p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  if (workflowsError) {
    return (
      <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
        <div className="text-destructive text-lg font-semibold">Failed to load workflow data</div>
        <p className="text-muted-foreground">
          {workflowsError.message || "Database connection required."}
        </p>
        <Button onClick={() => mutate("/api/workflows")} variant="outline">
          Retry Connection
        </Button>
      </div>
    )
  }

  if (workflows && workflows.length === 0 && creationFailed) {
    return (
      <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground text-lg font-semibold">No Workspaces Detected</div>
        <p className="text-muted-foreground text-sm">
          Please create a Project Workspace first via the main Dashboard.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
    )
  }

  const hasWorkflowData = workflow != null
  if (isLoadingWorkflows || !workflowId || (!hasWorkflowData && isLoading)) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading workflow...</div>
      </div>
    )
  }

  const viewport = getViewport()

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <NodeSidebar
        isOpen={showSidebar}
        onToggle={() => setShowSidebar(!showSidebar)}
        onAddNode={handleAddNode}
      />

      <div className="relative flex flex-1 flex-col">
        <div className="absolute top-4 right-4 left-4 z-50" data-testid="builder-toolbar">
          <GlassContainer className="flex items-center gap-3 px-3 py-2 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-sm font-semibold tracking-tight">
                {workflow?.name || "Untitled Workflow"}
              </h1>
              <span className="border-border/80 bg-muted/40 text-muted-foreground rounded-xl border px-2 py-0.5 text-[10px] font-medium">
                v{workflow?.version || 1}
              </span>
            </div>

            <div className="border-border/80 bg-background/70 ml-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border p-1">
              <ExportImportDialog
                workflowId={workflowId}
                onImportSuccess={(newWorkflow) => {
                  mutate("/api/workflows")
                  if (newWorkflow?.id) {
                    setWorkflowId(newWorkflow.id)
                    mutate(`/api/workflows/${newWorkflow.id}`)
                  } else {
                    mutate(`/api/workflows/${workflowId}`)
                  }
                }}
              />
              <div className="bg-border/80 mx-1 h-4 w-px" />
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent h-8 w-8 rounded-lg"
                onClick={handleUndo}
                disabled={!historyStatus?.canUndo}
                aria-label="Undo"
                title="Undo"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent h-8 w-8 rounded-lg"
                onClick={handleRedo}
                disabled={!historyStatus?.canRedo}
                aria-label="Redo"
                title="Redo"
              >
                <Redo className="h-4 w-4" />
              </Button>
              <div className="bg-border/80 mx-1 h-4 w-px" />
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent h-8 w-8 rounded-lg"
                onClick={handleAutoLayout}
                title="Auto Layout"
                aria-label="Auto Layout"
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent h-8 w-8 rounded-lg"
                onClick={handleZoomOut}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span
                className="text-muted-foreground w-10 text-center text-xs font-medium select-none"
                aria-live="polite"
              >
                {Math.round((viewport?.zoom ?? 1) * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent h-8 w-8 rounded-lg"
                onClick={handleZoomIn}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent h-8 w-8 rounded-lg"
                onClick={handleResetView}
                aria-label="Fit view"
                title="Fit view"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <div className="bg-border/80 mx-1 h-4 w-px" />
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent h-8 w-8 rounded-lg"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                aria-label="Version history"
                title="Version history"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 ml-1 h-8 gap-2 rounded-xl"
                onClick={() => setShowExecutionMonitor(!showExecutionMonitor)}
              >
                <Play className="h-3.5 w-3.5" />
                {showExecutionMonitor ? "Close" : "Run"}
              </Button>
              <Button size="sm" className="h-8 gap-2 rounded-xl" onClick={handleSaveVersion}>
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </GlassContainer>
        </div>

        <div
          className="bg-background relative h-full w-full flex-1"
          data-testid="builder-canvas"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
          }}
          onDrop={(e) => {
            e.preventDefault()
            const raw = e.dataTransfer.getData("application/json")
            if (!raw) return
            try {
              const { type } = JSON.parse(raw) as { type: NodeType; label: string }
              if (!type || !NODE_TYPES.includes(type)) return
              const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
              const snapped = {
                x: Math.round(flowPos.x / GRID_SIZE) * GRID_SIZE,
                y: Math.round(flowPos.y / GRID_SIZE) * GRID_SIZE,
              }
              handleAddNode(type, snapped)
            } catch {
              // Ignore invalid JSON from clipboard
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.04)_0%,transparent_75%)]" />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeDragStop={handleNodeDragStop}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneClick={handleCloseMenu}
            onNodeClick={handleCloseMenu}
            nodeTypes={nodeTypes}
            snapToGrid
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            fitView
            minZoom={0.25}
            maxZoom={2}
            panOnDrag={[1, 2]}
            panOnScroll
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            selectNodesOnDrag={false}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={GRID_SIZE} size={1} color="rgba(255,255,255,0.03)" />
            <Button
              variant="ghost"
              size="sm"
              className="border-border/80 bg-card/80 text-muted-foreground hover:text-foreground absolute right-4 bottom-4 h-8 rounded-lg border px-2.5 text-xs"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette"
            >
              <kbd className="font-mono">⌘K</kbd>
              <span className="ml-1.5">Commands</span>
            </Button>

            {menuType === "pane" && menuPosition && (
              <div
                className="pointer-events-none fixed z-[100]"
                style={{ top: menuPosition.y, left: menuPosition.x }}
              >
                <PaneContextMenu
                  onPaste={() => {
                    handlePaste()
                    handleCloseMenu()
                  }}
                  onAutoLayout={() => {
                    handleAutoLayout()
                    handleCloseMenu()
                  }}
                  onAddFrame={() => {
                    handleAddFrame()
                    handleCloseMenu()
                  }}
                  open={true}
                  onOpenChange={(open) => !open && handleCloseMenu()}
                >
                  <div className="h-px w-px" />
                </PaneContextMenu>
              </div>
            )}

            {menuType === "node" && menuPosition && menuNodeId && (
              <div
                className="pointer-events-none fixed z-[100]"
                style={{ top: menuPosition.y, left: menuPosition.x }}
              >
                <NodeContextMenu
                  nodeId={menuNodeId}
                  nodeType={workflow?.nodes.find((n) => n.id === menuNodeId)?.type}
                  parentId={workflow?.nodes.find((n) => n.id === menuNodeId)?.parentId || undefined}
                  onDuplicate={() => {
                    handleDuplicateById(menuNodeId)
                    handleCloseMenu()
                  }}
                  onCopy={() => {
                    handleCopyById(menuNodeId)
                    handleCloseMenu()
                  }}
                  onDelete={() => {
                    handleNodeDeleteById(menuNodeId)
                    handleCloseMenu()
                  }}
                  onAssignToFrame={(nodeId, frameId) => {
                    handleAssignToFrame(nodeId, frameId)
                    handleCloseMenu()
                  }}
                  onRemoveFromFrame={(nodeId) => {
                    handleRemoveFromFrame(nodeId)
                    handleCloseMenu()
                  }}
                  frames={workflow?.nodes.filter((n) => n.type === "frame")}
                  open={true}
                  onOpenChange={(open) => !open && handleCloseMenu()}
                >
                  <div className="h-px w-px" />
                </NodeContextMenu>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>

      <NodePropertiesPanel
        isOpen={showProperties}
        onToggle={() => setShowProperties(!showProperties)}
        node={selectedNode}
        workflowId={workflowId}
        onUpdate={() => mutate(`/api/workflows/${workflowId}`)}
      />

      <VersionHistoryPanel
        workflowId={workflowId}
        isOpen={showVersionHistory}
        onToggle={() => setShowVersionHistory(!showVersionHistory)}
        onRestoreVersion={(_version) => {}}
      />

      <ExecutionMonitor
        workflowId={workflowId}
        isOpen={showExecutionMonitor}
        onClose={() => setShowExecutionMonitor(false)}
        onNodeHighlight={setHighlightedNodeId}
      />

      <BuilderCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSave={handleSaveVersion}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={handleAutoLayout}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleResetView}
        onAddNode={handleAddNode}
        onAddFrame={handleAddFrame}
        canUndo={historyStatus?.canUndo}
        canRedo={historyStatus?.canRedo}
      />
    </div>
  )
}

export function BuilderCanvas() {
  return (
    <ReactFlowProvider>
      <BuilderCanvasInner />
    </ReactFlowProvider>
  )
}
