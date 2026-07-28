"use client"

import { useCallback, useState } from "react"
import {
  connectionIdsAlongNodePath,
  connectionIdsTouchingNode,
} from "@/lib/builder/workflow-to-reactflow"
import type { Connection } from "@/lib/workflow-types"

export function useBuilderExecutionHighlight(connections: Connection[] | undefined) {
  const [showExecutionMonitor, setShowExecutionMonitor] = useState(false)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<string[]>([])
  const [executionPathNodeIds, setExecutionPathNodeIds] = useState<string[]>([])

  const clearExecutionHighlights = useCallback(() => {
    setHighlightedNodeId(null)
    setHighlightedEdgeIds([])
    setExecutionPathNodeIds([])
  }, [])

  const handleNodeHighlight = useCallback(
    (nodeId: string | null) => {
      setHighlightedNodeId(nodeId)
      if (!nodeId) {
        setHighlightedEdgeIds([])
        return
      }
      const pathEdges = connectionIdsAlongNodePath(connections ?? [], executionPathNodeIds)
      if (pathEdges.length > 0) {
        const touching = new Set(connectionIdsTouchingNode(connections ?? [], nodeId))
        setHighlightedEdgeIds(pathEdges.filter((id) => touching.has(id)))
        return
      }
      setHighlightedEdgeIds(connectionIdsTouchingNode(connections ?? [], nodeId))
    },
    [connections, executionPathNodeIds],
  )

  const handleExecutionPath = useCallback(
    (nodeIds: string[]) => {
      const path = nodeIds.filter(Boolean)
      setExecutionPathNodeIds(path)
      setHighlightedEdgeIds(connectionIdsAlongNodePath(connections ?? [], path))
      setHighlightedNodeId(path.length > 0 ? path[path.length - 1] : null)
    },
    [connections],
  )

  const handleCloseExecutionMonitor = useCallback(() => {
    setShowExecutionMonitor(false)
    clearExecutionHighlights()
  }, [clearExecutionHighlights])

  const handleToggleExecutionMonitor = useCallback(() => {
    if (showExecutionMonitor) {
      clearExecutionHighlights()
    }
    setShowExecutionMonitor(!showExecutionMonitor)
  }, [showExecutionMonitor, clearExecutionHighlights])

  return {
    showExecutionMonitor,
    highlightedNodeId,
    highlightedEdgeIds,
    handleNodeHighlight,
    handleExecutionPath,
    handleCloseExecutionMonitor,
    handleToggleExecutionMonitor,
  }
}
