"use client"

import { useCallback, useRef } from "react"
import type { Connection, WorkflowNode } from "@/lib/workflow-types"
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

export function useBuilderClipboard(options: {
  workflowId: string | null
  selectedNodeId: string | null
  saveToHistory: () => void
  mutateWorkflow: (id: string) => void
  safeFetch: SafeFetch
  toast: ToastFn
}) {
  const { workflowId, selectedNodeId, saveToHistory, mutateWorkflow, safeFetch, toast } = options
  const clipboardRef = useRef<ClipboardPayload | null>(null)

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
      mutateWorkflow(workflowId)
      toast({ title: `Pasted ${result.nodeIds?.length ?? 0} node(s)` })
    } else {
      toast({ title: "Nothing to paste", variant: "destructive" })
    }
  }, [workflowId, saveToHistory, mutateWorkflow, toast, safeFetch])

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
      mutateWorkflow(workflowId)
      toast({ title: "Node duplicated" })
    }
  }, [selectedNodeId, workflowId, saveToHistory, mutateWorkflow, toast, safeFetch])

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
        mutateWorkflow(workflowId)
        toast({ title: "Node duplicated" })
      }
    },
    [workflowId, saveToHistory, mutateWorkflow, toast, safeFetch],
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

  return {
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleDuplicateById,
    handleCopyById,
  }
}
