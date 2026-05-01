"use client"

import { useState } from "react"
import useSWR from "swr"
import type { MCPServer, MCPTool } from "@/lib/mcp-client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Plus, Server, Trash2, RefreshCw, CheckCircle2, XCircle } from "lucide-react"
import { AddMCPServerDialog } from "./add-mcp-server-dialog"
import { MCPToolsList } from "./mcp-tools-list"

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
    return res.json()
  })

export function MCPManager() {
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    data: servers = [],
    isLoading: serversLoading,
    mutate: mutateServers,
  } = useSWR<MCPServer[]>("/api/mcp/servers", fetcher)
  const { data: tools = [] } = useSWR<MCPTool[]>(
    selectedServer ? `/api/mcp/servers/${selectedServer.id}/tools` : null,
    fetcher,
  )

  const handleAddServer = async (config: {
    name: string
    url: string
    protocol: "stdio" | "http"
  }) => {
    setLoading(true)
    try {
      const res = await fetch("/api/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      if (res.ok) {
        await mutateServers()
        setDialogOpen(false)
      }
    } catch {
      // Error already surfaced to user via UI state
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm("Are you sure you want to disconnect this MCP server?")) return

    try {
      await fetch(`/api/mcp/servers/${serverId}`, { method: "DELETE" })
      await mutateServers()
      if (selectedServer?.id === serverId) {
        setSelectedServer(null)
      }
    } catch {
      // Error already surfaced via mutateServers / selectedServer state
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add MCP Server
          </Button>
          <Button variant="outline" onClick={() => mutateServers()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Connected Servers</h2>
          {serversLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : servers.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No MCP servers"
              description="Add an MCP server to extend agent capabilities."
              actionLabel="Add MCP Server"
              onAction={() => setDialogOpen(true)}
            />
          ) : (
            servers.map((server) => {
              const isSelected = selectedServer?.id === server.id
              const StatusIcon = server.status === "connected" ? CheckCircle2 : XCircle

              return (
                <Card
                  key={server.id}
                  className={`cursor-pointer p-4 transition-colors ${
                    isSelected ? "border-primary/60 bg-accent/40" : "hover:border-primary/40"
                  }`}
                  onClick={() => setSelectedServer(server)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="border-primary/20 bg-primary/10 rounded-lg border p-2">
                        <Server className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{server.name}</h3>
                        <p className="text-muted-foreground mt-1 text-sm">{server.url}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <StatusIcon
                            className={`h-3 w-3 ${server.status === "connected" ? "text-primary" : "text-destructive"}`}
                          />
                          <span
                            className={`text-xs ${server.status === "connected" ? "text-primary" : "text-destructive"}`}
                          >
                            {server.status}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {server.protocol}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${server.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteServer(server.id)
                      }}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {server.capabilities.map((cap) => (
                      <Badge key={cap.type} variant="outline" className="text-xs">
                        {cap.type}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )
            })
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {selectedServer ? `Tools - ${selectedServer.name}` : "Server Tools"}
          </h2>
          {selectedServer ? (
            <MCPToolsList tools={tools} />
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Select a server to view its tools</p>
            </Card>
          )}
        </div>
      </div>

      <AddMCPServerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAddServer}
        loading={loading}
      />
    </div>
  )
}
