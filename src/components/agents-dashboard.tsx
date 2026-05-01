"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Bot, MoreHorizontal, Pencil, Trash2, History, Play } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { AnimatedText } from "@/components/ui/animated-text"
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import type { Agent } from "@/lib/types"
import { CreateAgentDialog } from "@/components/create-agent-dialog"
import { EditAgentDialog } from "@/components/edit-agent-dialog"
import { formatDistanceToNow } from "date-fns"

const FLUID_BADGE = "bg-black/5 dark:bg-white/10 backdrop-blur-sm text-xs"
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function AgentsDashboard() {
  const { data: agents = [], isLoading: loading, mutate } = useSWR<Agent[]>("/api/agents", fetcher)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    await fetch(`/api/agents/${id}`, { method: "DELETE" })
    mutate()
    setDeletingAgentId(null)
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <AnimatedText
            text="Agents"
            as="h1"
            className="text-3xl leading-snug font-bold tracking-tight"
          />
          <p className="text-muted-foreground mt-1">Create and manage your AI agents</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] w-full rounded-xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first AI agent to get started"
          actionLabel="Create Agent"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
        <>
          <BentoGrid className="mb-8">
            <BentoCard
              icon={Bot}
              title="Total Agents"
              value={agents.length}
              description="Configured agents in your workspace"
              className="md:col-span-2"
            />
            <BentoCard
              icon={History}
              title="Latest Activity"
              value={
                agents.length > 0
                  ? formatDistanceToNow(
                      new Date(Math.max(...agents.map((a) => new Date(a.updatedAt).getTime()))),
                      { addSuffix: true },
                    )
                  : "—"
              }
              description="Most recent agent update"
            />
          </BentoGrid>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className="group border-border/80 hover:border-primary/20 hover-lift transition-all duration-300"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="border-primary/20 bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg border">
                        <Bot className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <p className="text-muted-foreground mt-0.5 text-xs">{agent.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
                      <Button variant="ghost" size="icon" asChild title="Run Agent">
                        <Link href={`/runs?agentId=${agent.id}`}>
                          <Play className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Agent actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingAgent(agent)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingAgentId(agent.id)}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4 line-clamp-2">
                    {agent.description}
                  </CardDescription>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {agent.tools.slice(0, 3).map((toolId) => (
                      <Badge key={toolId} variant="secondary" className={FLUID_BADGE}>
                        {toolId.replace("-", " ")}
                      </Badge>
                    ))}
                    {agent.tools.length > 3 && (
                      <Badge variant="secondary" className={FLUID_BADGE}>
                        +{agent.tools.length - 3} more
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs">
                      Updated {formatDistanceToNow(new Date(agent.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <CreateAgentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => mutate()}
      />

      {editingAgent && (
        <EditAgentDialog
          agent={editingAgent}
          open={!!editingAgent}
          onOpenChange={(open) => !open && setEditingAgent(null)}
          onUpdated={() => mutate()}
        />
      )}

      <AlertDialog
        open={!!deletingAgentId}
        onOpenChange={(open) => !open && setDeletingAgentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your agent and remove its
              data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingAgentId && handleDelete(deletingAgentId)}
            >
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
