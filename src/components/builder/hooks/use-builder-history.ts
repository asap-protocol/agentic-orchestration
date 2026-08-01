"use client"

import { useCallback, useRef, useState, useSyncExternalStore } from "react"
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

function workflowUpdatedAtMs(workflow: Workflow): number {
  const value = workflow.updatedAt
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value as unknown as string).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
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
  const transitionInFlightRef = useRef(false)
  const [isHistoryTransitioning, setIsHistoryTransitioning] = useState(false)
  const lastPersistedRef = useRef<Workflow | null>(null)
  const lastSyncedUpdatedAtRef = useRef<number | null>(null)

  if (workflow) {
    const updatedAtMs = workflowUpdatedAtMs(workflow)
    if (lastSyncedUpdatedAtRef.current !== updatedAtMs) {
      lastSyncedUpdatedAtRef.current = updatedAtMs
      lastPersistedRef.current = workflow
    }
  }

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

  const saveToHistory = useCallback(
    (snapshot?: Workflow) => {
      const toSave = snapshot ?? workflow
      if (toSave && workflowId) {
        getHistoryManager(workflowId).saveState(toSave)
      }
    },
    [workflow, workflowId],
  )

  const applyHistoryTransition = useCallback(
    async (direction: "undo" | "redo") => {
      if (!workflowId || !workflow) return
      // Serialize: overlapping ⌘Z must not push duplicate redo entries or race PATCHes.
      if (transitionInFlightRef.current) return
      transitionInFlightRef.current = true
      setIsHistoryTransitioning(true)

      const historyManager = getHistoryManager(workflowId)
      const current = lastPersistedRef.current ?? workflow
      let snapshot: Workflow | null
      switch (direction) {
        case "undo":
          snapshot = historyManager.undo(current)
          break
        case "redo":
          snapshot = historyManager.redo(current)
          break
        default: {
          const _exhaustive: never = direction
          transitionInFlightRef.current = false
          setIsHistoryTransitioning(false)
          return _exhaustive
        }
      }
      if (!snapshot) {
        transitionInFlightRef.current = false
        setIsHistoryTransitioning(false)
        return
      }

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
        lastPersistedRef.current = snapshot
        mutateWorkflow(workflowId)
      } catch {
        rollbackHistoryTransition(historyManager, direction, snapshot)
      } finally {
        transitionInFlightRef.current = false
        setIsHistoryTransitioning(false)
      }
    },
    [workflowId, workflow, mutateWorkflow, safeFetch],
  )

  const handleUndo = useCallback(() => applyHistoryTransition("undo"), [applyHistoryTransition])
  const handleRedo = useCallback(() => applyHistoryTransition("redo"), [applyHistoryTransition])

  const resolveLatestPersistedWorkflow = useCallback(async (): Promise<Workflow> => {
    const fallback = (lastPersistedRef.current ?? workflow) as Workflow
    try {
      const response = await safeFetch(`/api/workflows/${workflowId}`)
      if (!response.ok) return fallback
      const fresh = (await response.json()) as Workflow
      lastPersistedRef.current = fresh
      return fresh
    } catch {
      return fallback
    }
  }, [workflowId, workflow, safeFetch])

  const handleRestoreVersion = useCallback(
    async (version: WorkflowVersion) => {
      if (!workflowId || !workflow) return
      if (transitionInFlightRef.current) return
      transitionInFlightRef.current = true
      setIsHistoryTransitioning(true)
      try {
        const previous = await resolveLatestPersistedWorkflow()
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
        lastPersistedRef.current = {
          ...previous,
          nodes: version.nodes,
          connections: version.connections,
        }
        mutateWorkflow(workflowId)
        toast({
          title: "Version restored",
          description: `Restored ${version.name}`,
        })
      } catch {
        // Leave stacks untouched when network fails before a successful persist.
      } finally {
        transitionInFlightRef.current = false
        setIsHistoryTransitioning(false)
      }
    },
    [workflowId, workflow, mutateWorkflow, safeFetch, toast, resolveLatestPersistedWorkflow],
  )

  return {
    canUndo,
    canRedo,
    isHistoryTransitioning,
    saveToHistory,
    mutateWorkflow,
    handleUndo,
    handleRedo,
    handleRestoreVersion,
  }
}
