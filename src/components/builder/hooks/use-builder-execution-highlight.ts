"use client"

import { useCallback, useState } from "react"
import { connectionIdsTouchingNode } from "@/lib/builder/workflow-to-reactflow"
import type { Connection } from "@/lib/workflow-types"

export function useBuilderExecutionHighlight(connections: Connection[] | undefined) {
  const [showExecutionMonitor, setShowExecutionMonitor] = useState(false)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<string[]>([])

  const clearExecutionHighlights = useCallback(() => {
    setHighlightedNodeId(null)
    setHighlightedEdgeIds([])
  }, [])

  const handleNodeHighlight = useCallback(
    (nodeId: string | null) => {
      setHighlightedNodeId(nodeId)
      if (!nodeId) {
        setHighlightedEdgeIds([])
        return
      }
      setHighlightedEdgeIds(connectionIdsTouchingNode(connections ?? [], nodeId))
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
    handleCloseExecutionMonitor,
    handleToggleExecutionMonitor,
  }
}
