"use client"

import type { Connector } from "@/lib/connector-types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Plug, CheckCircle2, XCircle } from "lucide-react"

interface ConnectorCardProps {
  connector: Connector
  onConnect: (connector: Connector) => void
}

export function ConnectorCard({ connector, onConnect }: ConnectorCardProps) {
  const statusConfig = {
    connected: { icon: CheckCircle2, color: "text-primary", label: "Connected" },
    disconnected: { icon: XCircle, color: "text-muted-foreground", label: "Not connected" },
    error: { icon: XCircle, color: "text-destructive", label: "Error" },
    pending: { icon: Plug, color: "text-accent-foreground", label: "Pending" },
  }

  const status = statusConfig[connector.status]
  const StatusIcon = status.icon

  return (
    <Card className="border-border/80 hover:border-primary/20 hover-lift p-6 transition-all duration-300">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
            style={{ backgroundColor: `color-mix(in oklch, ${connector.color} 8%, transparent)` }}
          >
            {connector.icon}
          </div>
          <div>
            <h3 className="font-semibold">{connector.name}</h3>
            <div className="mt-1 flex items-center gap-2">
              <StatusIcon className={`h-3 w-3 ${status.color}`} />
              <span className={`text-xs ${status.color}`}>{status.label}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground mb-4 text-sm leading-relaxed">{connector.description}</p>

      <div className="mb-4 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {connector.category}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {connector.authType}
        </Badge>
        {connector.isOfficial && (
          <Badge variant="default" className="text-xs">
            Official
          </Badge>
        )}
        {connector.isPremium && (
          <Badge
            variant="default"
            className="border-accent-foreground/20 bg-accent text-accent-foreground border text-xs"
          >
            Premium
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {connector.status === "connected" ? (
          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
            Manage
          </Button>
        ) : (
          <Button size="sm" className="flex-1" onClick={() => onConnect(connector)}>
            <Plug className="mr-2 h-4 w-4" />
            Connect
          </Button>
        )}
        {connector.website && (
          <Button variant="ghost" size="icon" asChild aria-label={`Open ${connector.name} website`}>
            <a href={connector.website} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </Card>
  )
}
