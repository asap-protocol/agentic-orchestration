"use client"

import type { MCPTool } from "@/lib/mcp-client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wrench } from "lucide-react"

interface MCPToolsListProps {
  tools: MCPTool[]
}

export function MCPToolsList({ tools }: MCPToolsListProps) {
  if (tools.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Wrench className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <p className="text-muted-foreground">No tools available</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <Card key={`${tool.serverId}-${tool.name}`} className="border-border/80 p-4">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="text-primary h-4 w-4" />
              <h4 className="font-semibold">{tool.name}</h4>
            </div>
            <Badge variant="secondary" className="text-xs">
              MCP Tool
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{tool.description}</p>
          {tool.inputSchema && (
            <div className="border-border/80 bg-muted/30 mt-3 rounded-lg border p-3">
              <p className="text-muted-foreground font-mono text-xs">
                {JSON.stringify(tool.inputSchema, null, 2).slice(0, 150)}
                {JSON.stringify(tool.inputSchema).length > 150 ? "..." : ""}
              </p>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
