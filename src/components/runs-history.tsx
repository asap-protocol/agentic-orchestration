"use client"

import { useState } from "react"
import { formatDistanceToNow, format } from "date-fns"
import {
  History,
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Clock,
  MessageSquare,
  Wrench,
  Search,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Run } from "@/lib/types"
import { cn } from "@/lib/utils"

const sampleRuns: Run[] = [
  {
    id: "run-1",
    agentId: "research-agent",
    agentName: "Research Assistant",
    status: "completed",
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 45000),
    messages: [
      {
        id: "m1",
        role: "user",
        content: "What is the latest news about AI?",
        timestamp: new Date(),
      },
      {
        id: "m2",
        role: "assistant",
        content: "I'll search for the latest AI news for you...",
        timestamp: new Date(),
      },
    ],
    toolCalls: [
      {
        id: "tc1",
        toolName: "web_search",
        input: { query: "latest AI news 2024" },
        output: { results: [{ title: "AI Advances in 2024" }] },
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ],
  },
  {
    id: "run-2",
    agentId: "code-agent",
    agentName: "Code Helper",
    status: "completed",
    startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000 + 120000),
    messages: [
      { id: "m1", role: "user", content: "Calculate 2^10 for me", timestamp: new Date() },
      { id: "m2", role: "assistant", content: "2^10 equals 1024.", timestamp: new Date() },
    ],
    toolCalls: [
      {
        id: "tc1",
        toolName: "calculate",
        input: { expression: "2**10" },
        output: { result: 1024 },
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ],
  },
  {
    id: "run-3",
    agentId: "research-agent",
    agentName: "Research Assistant",
    status: "failed",
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 5000),
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Search for quantum computing papers",
        timestamp: new Date(),
      },
    ],
    toolCalls: [
      {
        id: "tc1",
        toolName: "file_search",
        input: { query: "quantum computing" },
        status: "failed",
        error: "No files uploaded",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ],
  },
]

export function RunsHistory() {
  const [runs] = useState<Run[]>(sampleRuns)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)

  const filteredRuns = runs.filter((run) => {
    const matchesSearch = run.agentName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || run.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status: Run["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    }
  }

  const getStatusBadge = (status: Run["status"]) => {
    const variants: Record<Run["status"], string> = {
      completed: "border-primary/20 bg-primary/10 text-primary",
      failed: "border-destructive/20 bg-destructive/10 text-destructive",
      running: "border-accent-foreground/20 bg-accent text-accent-foreground",
    }
    return variants[status]
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl leading-snug font-bold">Run History</h1>
        <p className="text-muted-foreground">View past agent runs and their execution logs</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search by agent name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredRuns.length === 0 ? (
        <EmptyState
          icon={History}
          title="No runs found"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Run an agent to see execution history here."
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run) => (
            <Card
              key={run.id}
              className="hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => setSelectedRun(run)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                      <Bot className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{run.agentName}</h3>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getStatusBadge(run.status))}
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" />
                        {run.messages.length}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Wrench className="h-4 w-4" />
                        {run.toolCalls.length}
                      </div>
                      {run.completedAt && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {Math.round(
                            (new Date(run.completedAt).getTime() -
                              new Date(run.startedAt).getTime()) /
                              1000,
                          )}
                          s
                        </div>
                      )}
                    </div>
                    <ChevronRight className="text-muted-foreground h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRun && getStatusIcon(selectedRun.status)}
              Run Details
            </DialogTitle>
          </DialogHeader>
          {selectedRun && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-sm">Agent</p>
                    <p className="font-medium">{selectedRun.agentName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Status</p>
                    <Badge
                      variant="outline"
                      className={cn("mt-1", getStatusBadge(selectedRun.status))}
                    >
                      {selectedRun.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Started</p>
                    <p className="font-medium">{format(new Date(selectedRun.startedAt), "PPpp")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Duration</p>
                    <p className="font-medium">
                      {selectedRun.completedAt
                        ? `${Math.round((new Date(selectedRun.completedAt).getTime() - new Date(selectedRun.startedAt).getTime()) / 1000)}s`
                        : "Running..."}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">Messages</h4>
                  <div className="space-y-2">
                    {selectedRun.messages.map((msg) => (
                      <div key={msg.id} className="bg-muted rounded-lg p-3">
                        <p className="text-muted-foreground mb-1 text-xs capitalize">{msg.role}</p>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">Tool Calls</h4>
                  <div className="space-y-2">
                    {selectedRun.toolCalls.map((tc) => (
                      <Card key={tc.id}>
                        <CardContent className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{tc.toolName}</Badge>
                              {tc.status === "completed" && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              {tc.status === "failed" && (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <div>
                              <p className="text-muted-foreground text-xs">Input</p>
                              <pre className="bg-muted mt-1 rounded p-2 text-xs">
                                {JSON.stringify(tc.input, null, 2)}
                              </pre>
                            </div>
                            {tc.output ? (
                              <div>
                                <p className="text-muted-foreground text-xs">Output</p>
                                <pre className="bg-muted mt-1 rounded p-2 text-xs">
                                  {JSON.stringify(tc.output, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                            {tc.error ? (
                              <div>
                                <p className="text-xs text-red-500">Error: {tc.error}</p>
                              </div>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
