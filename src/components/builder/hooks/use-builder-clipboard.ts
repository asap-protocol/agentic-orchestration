"use client"

import { useCallback, useRef } from "react"
import type { Connection, Workflow, WorkflowNode } from "@/lib/workflow-types"
import type { SafeFetch } from "../builder-constants"

type ToastFn = (props: {
  title: string
  description?: string
  variant?: "default" | "destructive"
}) => void

type ClipboardPayload = {
  nodes: WorkflowNode[]
  connections: Connection[]
}

type SaveToHistory = () => void

type MutateWorkflow = (id: string) => Promise<void>

export function useBuilderClipboard(options: {
  workflowId: string | null
  selectedNodeIds: string[]
  workflow: Workflow | null | undefined
  saveToHistory: SaveToHistory
  mutateWorkflow: MutateWorkflow
  safeFetch: SafeFetch
  toast: ToastFn
}) {
  const { workflowId, selectedNodeIds, workflow, saveToHistory, mutateWorkflow, safeFetch, toast } =
    options
  const clipboardRef = useRef<ClipboardPayload | null>(null)

  const copyNodeIds = useCallback(
    async (nodeIds: string[]) => {
      if (!nodeIds.length || !workflowId) return false
      const response = await safeFetch(`/api/workflows/${workflowId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeIds }),
      })
      if (!response.ok) return false
      const result = await response.json()
      clipboardRef.current = { nodes: result.nodes ?? [], connections: result.connections ?? [] }
      return true
    },
    [workflowId, safeFetch],
  )

  const handleCopy = useCallback(async () => {
    if (!selectedNodeIds.length) return
    const ok = await copyNodeIds(selectedNodeIds)
    if (ok) {
      toast({
        title:
          selectedNodeIds.length === 1
            ? "Node copied to clipboard"
            : `${selectedNodeIds.length} nodes copied to clipboard`,
      })
    }
  }, [selectedNodeIds, copyNodeIds, toast])

  const handlePaste = useCallback(async () => {
    if (!workflowId || !workflow) return
    const clipboard = clipboardRef.current
    if (!clipboard?.nodes?.length) {
      toast({ title: "Nothing to paste", variant: "destructive" })
      return
    }
    const response = await safeFetch(`/api/workflows/${workflowId}/paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: clipboard.nodes, connections: clipboard.connections }),
    })
    if (response.ok) {
      const result = await response.json()
      saveToHistory()
      await mutateWorkflow(workflowId)
      toast({ title: `Pasted ${result.nodeIds?.length ?? 0} node(s)` })
    } else {
      toast({ title: "Nothing to paste", variant: "destructive" })
    }
  }, [workflowId, workflow, saveToHistory, mutateWorkflow, toast, safeFetch])

  const duplicateNodeIds = useCallback(
    async (nodeIds: string[], successTitle: string) => {
      if (!nodeIds.length || !workflowId || !workflow) return
      const copied = await copyNodeIds(nodeIds)
      if (!copied || !clipboardRef.current) return
      const pasteRes = await safeFetch(`/api/workflows/${workflowId}/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: clipboardRef.current.nodes,
          connections: clipboardRef.current.connections,
        }),
      })
      if (pasteRes.ok) {
        saveToHistory()
        await mutateWorkflow(workflowId)
        toast({ title: successTitle })
      }
    },
    [workflowId, workflow, copyNodeIds, saveToHistory, mutateWorkflow, toast, safeFetch],
  )

  const handleDuplicate = useCallback(async () => {
    await duplicateNodeIds(
      selectedNodeIds,
      selectedNodeIds.length === 1
        ? "Node duplicated"
        : `${selectedNodeIds.length} nodes duplicated`,
    )
  }, [selectedNodeIds, duplicateNodeIds])

  const handleDuplicateById = useCallback(
    async (nodeId: string) => {
      await duplicateNodeIds([nodeId], "Node duplicated")
    },
    [duplicateNodeIds],
  )

  const handleCopyById = useCallback(
    async (nodeId: string) => {
      const ok = await copyNodeIds([nodeId])
      if (ok) {
        toast({ title: "Node copied to clipboard" })
      }
    },
    [copyNodeIds, toast],
  )

  return {
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleDuplicateById,
    handleCopyById,
  }
}
