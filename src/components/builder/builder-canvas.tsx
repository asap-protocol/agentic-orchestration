"use client"

import type React from "react"

import { useState, useCallback, useEffect, useMemo } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useReactFlow,
  useViewport,
  useNodesState,
  useEdgesState,
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
import type { NodeType, Workflow } from "@/lib/workflow-types"
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
import { useToast } from "@/hooks/use-toast"
import {
  workflowNodesToReactFlow,
  workflowConnectionsToEdges,
} from "@/lib/builder/workflow-to-reactflow"
import { edgeTypes } from "./edges"
import type { WorkflowNodeData, WorkflowNodeProps } from "./canvas-node"
import type { FrameNodeData } from "./frame-node"
import { GRID_SIZE, NODE_TYPES } from "./builder-constants"
import { useBuilderHistory } from "./hooks/use-builder-history"
import { useBuilderExecutionHighlight } from "./hooks/use-builder-execution-highlight"
import { useBuilderClipboard } from "./hooks/use-builder-clipboard"
import { useBuilderGraphMutations } from "./hooks/use-builder-graph-mutations"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function BuilderCanvasInner() {
  const { toast } = useToast()
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow()
  const viewport = useViewport()

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
  const [showSidebar, setShowSidebar] = useState(true)
  const [showProperties, setShowProperties] = useState(true)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [menuType, setMenuType] = useState<"node" | "pane" | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null)

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

  const {
    canUndo,
    canRedo,
    isHistoryTransitioning,
    saveToHistory,
    mutateWorkflow,
    handleUndo,
    handleRedo,
    handleRestoreVersion,
  } = useBuilderHistory({ workflowId, workflow, safeFetch, toast })

  const {
    showExecutionMonitor,
    highlightedNodeId,
    highlightedEdgeIds,
    handleNodeHighlight,
    handleExecutionPath,
    handleCloseExecutionMonitor,
    handleToggleExecutionMonitor,
  } = useBuilderExecutionHighlight(workflow?.connections)

  const initialNodes = workflow ? workflowNodesToReactFlow(workflow.nodes) : []
  const initialEdges = workflow
    ? workflowConnectionsToEdges(workflow.connections, {
        nodes: workflow.nodes,
        runningEdgeIds: highlightedEdgeIds,
      })
    : []

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const {
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
  } = useBuilderGraphMutations({
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
  })

  const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
  const selectedNodeId = selectedNodeIds[0] ?? null
  const selectedNode = workflow?.nodes?.find((n) => n.id === selectedNodeId)

  const { handleCopy, handlePaste, handleDuplicate, handleDuplicateById, handleCopyById } =
    useBuilderClipboard({
      workflowId,
      selectedNodeIds,
      workflow,
      saveToHistory,
      mutateWorkflow,
      safeFetch,
      toast,
    })

  useEffect(() => {
    if (!workflow) return
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

  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })))
  }, [setNodes, setEdges])

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

  const handleZoomIn = useCallback(() => zoomIn(), [zoomIn])
  const handleZoomOut = useCallback(() => zoomOut(), [zoomOut])
  const handleResetView = useCallback(() => fitView({ padding: 0.2 }), [fitView])

  const nodeTypes = useMemo(() => {
    return Object.fromEntries(
      NODE_TYPES.map((t) => [t, t === "frame" ? FrameNode : CanvasNode]),
    ) as Record<
      (typeof NODE_TYPES)[number],
      React.ComponentType<WorkflowNodeProps | NodeProps<Node<FrameNodeData, "frame">>>
    >
  }, [])

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
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeIds.length > 0) {
        e.preventDefault()
        void handleNodeDelete(selectedNodeIds)
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        void handleSaveVersion()
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
        void handleAutoLayout()
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
    selectedNodeIds,
  ])

  if (isUnauthorized) {
    return (
      <div className="bg-background flex h-full min-h-0 flex-col items-center justify-center gap-4">
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
      <div className="bg-background flex h-full min-h-0 flex-col items-center justify-center gap-4">
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
      <div className="bg-background flex h-full min-h-0 flex-col items-center justify-center gap-4">
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
      <div className="bg-background flex h-full min-h-0 items-center justify-center">
        <div className="text-muted-foreground">Loading workflow...</div>
      </div>
    )
  }

  return (
    <div className="bg-background flex h-full min-h-0 overflow-hidden">
      <NodeSidebar
        isOpen={showSidebar}
        onToggle={() => setShowSidebar(!showSidebar)}
        onAddNode={handleAddNode}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute top-4 right-4 left-4 z-50" data-testid="builder-toolbar">
          <GlassContainer className="shadow-sm" innerClassName="flex items-center gap-3 px-3 py-2">
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
                disabled={!canUndo || isHistoryTransitioning}
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
                disabled={!canRedo || isHistoryTransitioning}
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
                onClick={handleToggleExecutionMonitor}
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
              void handleAddNode(type, snapped)
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
                    void handlePaste()
                    handleCloseMenu()
                  }}
                  onAutoLayout={() => {
                    void handleAutoLayout()
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
                    void handleDuplicateById(menuNodeId)
                    handleCloseMenu()
                  }}
                  onCopy={() => {
                    void handleCopyById(menuNodeId)
                    handleCloseMenu()
                  }}
                  onDelete={() => {
                    void handleNodeDeleteById(menuNodeId)
                    handleCloseMenu()
                  }}
                  onAssignToFrame={(nodeId, frameId) => {
                    void handleAssignToFrame(nodeId, frameId)
                    handleCloseMenu()
                  }}
                  onRemoveFromFrame={(nodeId) => {
                    void handleRemoveFromFrame(nodeId)
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
        onRestoreVersion={handleRestoreVersion}
      />

      <ExecutionMonitor
        workflowId={workflowId}
        isOpen={showExecutionMonitor}
        onClose={handleCloseExecutionMonitor}
        onNodeHighlight={handleNodeHighlight}
        onExecutionPath={handleExecutionPath}
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
        canUndo={canUndo}
        canRedo={canRedo}
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
