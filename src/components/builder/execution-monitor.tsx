"use client"

import { useState } from "react"
import {
  Play,
  X,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Loader2,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { WorkflowExecution, ExecutionLog } from "@/lib/workflow-types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/ui/empty-state"

interface ExecutionMonitorProps {
  workflowId: string
  isOpen: boolean
  onClose: () => void
  onNodeHighlight?: (nodeId: string | null) => void
}

function JsonViewer({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false)
  const jsonStr = JSON.stringify(data, null, 2)
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="group relative mt-2">
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          handleCopy()
        }}
        title="Copy JSON"
      >
        {copied ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
      <pre className="bg-muted text-foreground overflow-x-auto rounded p-2 text-xs">{jsonStr}</pre>
    </div>
  )
}

export function ExecutionMonitor({
  workflowId,
  isOpen,
  onClose,
  onNodeHighlight,
}: ExecutionMonitorProps) {
  const [input, setInput] = useState("")
  const [execution, setExecution] = useState<WorkflowExecution | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const handleRun = async () => {
    if (!input.trim()) return

    setIsExecuting(true)
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      })

      const result = await response.json()
      setExecution(result)

      if (onNodeHighlight) {
        onNodeHighlight(null)
      }
    } catch (error) {
      console.error("Execution error:", error instanceof Error ? error.message : String(error))
    } finally {
      setIsExecuting(false)
    }
  }

  const getLogIcon = (type: ExecutionLog["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-rose-500" />
      case "info":
        return <ChevronRight className="text-primary h-4 w-4" />
      case "tool-call":
        return <Play className="text-accent-foreground h-4 w-4" />
      case "tool-result":
        return <CheckCircle2 className="text-primary h-4 w-4" />
    }
  }

  const getStatusBadge = (status: WorkflowExecution["status"]) => {
    switch (status) {
      case "running":
        return (
          <div className="border-accent-foreground/20 bg-accent text-accent-foreground flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running
          </div>
        )
      case "completed":
        return (
          <div className="border-primary/20 bg-primary/10 text-primary flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </div>
        )
      case "failed":
        return (
          <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium">
            <XCircle className="h-3 w-3" />
            Failed
          </div>
        )
      case "paused":
        return (
          <div className="border-accent-foreground/20 bg-accent text-accent-foreground flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium">
            <Pause className="h-3 w-3" />
            Paused
          </div>
        )
    }
  }

  if (!isOpen) return null

  return (
    <div className="bg-card/95 border-border fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l backdrop-blur-md">
      {/* Header */}
      <div className="border-border flex h-14 items-center justify-between border-b px-4">
        <h2 className="font-semibold">Execution Monitor</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label="Close execution monitor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Input Section */}
      <div className="border-border space-y-3 border-b p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Input Message</label>
          <Input
            placeholder="Enter your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isExecuting && handleRun()}
          />
        </div>
        <Button className="w-full" onClick={handleRun} disabled={isExecuting || !input.trim()}>
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Workflow
            </>
          )}
        </Button>
      </div>

      {/* Execution Results */}
      {execution && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Status Bar */}
          <div className="border-border space-y-2 border-b p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Status</span>
              {getStatusBadge(execution.status)}
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {execution.completedAt
                  ? `${Math.round((execution.completedAt.getTime() - execution.startedAt.getTime()) / 1000)}s`
                  : "In progress..."}
              </div>
              <div>{execution.logs.length} logs</div>
            </div>
          </div>

          {/* Logs */}
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-4">
              {execution.logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "border-border hover:bg-accent/50 cursor-pointer space-y-1 rounded-lg border p-3 transition-colors",
                    execution.currentNodeId === log.nodeId && "ring-primary ring-2",
                  )}
                  onClick={() => onNodeHighlight?.(log.nodeId)}
                >
                  <div className="flex items-start gap-2">
                    {getLogIcon(log.type)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{log.message}</p>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                        <span>{log.nodeId}</span>
                        {log.duration && <span>• {log.duration}ms</span>}
                      </div>
                      {log.data ? <JsonViewer data={log.data} /> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {!execution && !isExecuting && (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={Play}
            title="Ready to run"
            description="Enter a message above and click Run to start the workflow."
          />
        </div>
      )}
    </div>
  )
}
