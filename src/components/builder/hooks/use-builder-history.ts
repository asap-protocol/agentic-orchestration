"use client"

import { useCallback, useSyncExternalStore } from "react"
import { mutate } from "swr"
import { getHistoryManager } from "@/lib/history-manager"
import type { Workflow, WorkflowVersion } from "@/lib/workflow-types"
import type { SafeFetch } from "../builder-constants"

type ToastFn = (props: {
  title: string
  description?: string
  variant?: "default" | "destructive"
}) => void

function subscribeHistory(workflowId: string | null, onStoreChange: () => void): () => void {
  if (!workflowId) return () => {}
  return getHistoryManager(workflowId).subscribe(onStoreChange)
}

/** Primitive snapshot so useSyncExternalStore can compare by value. */
function getHistoryFlagsSnapshot(workflowId: string | null): string {
  if (!workflowId) return "0|0|0"
  const manager = getHistoryManager(workflowId)
  return `${manager.getRevision()}|${manager.canUndo() ? 1 : 0}|${manager.canRedo() ? 1 : 0}`
}

function rollbackHistoryTransition(
  historyManager: ReturnType<typeof getHistoryManager>,
  direction: "undo" | "redo",
  snapshot: Workflow,
) {
  switch (direction) {
    case "undo":
      historyManager.redo(snapshot)
      return
    case "redo":
      historyManager.undo(snapshot)
      return
    default: {
      const _exhaustive: never = direction
      return _exhaustive
    }
  }
}

export function useBuilderHistory(options: {
  workflowId: string | null
  workflow: Workflow | null | undefined
  safeFetch: SafeFetch
  toast: ToastFn
}) {
  const { workflowId, workflow, safeFetch, toast } = options

  const flagsSnapshot = useSyncExternalStore(
    (onStoreChange) => subscribeHistory(workflowId, onStoreChange),
    () => getHistoryFlagsSnapshot(workflowId),
    () => "0|0|0",
  )
  const [, canUndoBit, canRedoBit] = flagsSnapshot.split("|")
  const canUndo = canUndoBit === "1"
  const canRedo = canRedoBit === "1"

  const mutateWorkflow = useCallback((id: string) => {
    mutate(`/api/workflows/${id}`)
  }, [])

  const saveToHistory = useCallback(() => {
    if (workflow && workflowId) {
      getHistoryManager(workflowId).saveState(workflow)
    }
  }, [workflow, workflowId])

  const applyHistoryTransition = useCallback(
    async (direction: "undo" | "redo") => {
      if (!workflowId || !workflow) return
      const historyManager = getHistoryManager(workflowId)
      let snapshot: Workflow | null
      switch (direction) {
        case "undo":
          snapshot = historyManager.undo(workflow)
          break
        case "redo":
          snapshot = historyManager.redo(workflow)
          break
        default: {
          const _exhaustive: never = direction
          return _exhaustive
        }
      }
      if (!snapshot) return

      try {
        const response = await safeFetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes: snapshot.nodes,
            connections: snapshot.connections,
          }),
        })
        if (!response.ok) {
          rollbackHistoryTransition(historyManager, direction, snapshot)
          return
        }
        mutateWorkflow(workflowId)
      } catch {
        rollbackHistoryTransition(historyManager, direction, snapshot)
      }
    },
    [workflowId, workflow, mutateWorkflow, safeFetch],
  )

  const handleUndo = useCallback(() => applyHistoryTransition("undo"), [applyHistoryTransition])
  const handleRedo = useCallback(() => applyHistoryTransition("redo"), [applyHistoryTransition])

  const handleRestoreVersion = useCallback(
    async (version: WorkflowVersion) => {
      if (!workflowId || !workflow) return
      const previous = workflow
      try {
        const response = await safeFetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes: version.nodes,
            connections: version.connections,
          }),
        })
        if (!response.ok) return
        getHistoryManager(workflowId).saveState(previous)
        mutateWorkflow(workflowId)
        toast({
          title: "Version restored",
          description: `Restored ${version.name}`,
        })
      } catch {
        // Leave stacks untouched when network fails before a successful persist.
      }
    },
    [workflowId, workflow, mutateWorkflow, safeFetch, toast],
  )

  return {
    canUndo,
    canRedo,
    saveToHistory,
    mutateWorkflow,
    handleUndo,
    handleRedo,
    handleRestoreVersion,
  }
}
