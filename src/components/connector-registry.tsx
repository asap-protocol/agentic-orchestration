"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import type { Connector, ConnectorCategory } from "@/lib/connector-types"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plug, CheckCircle2, AlertCircle } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { ConnectorCard } from "./connector-card"
import { AddConnectionDialog } from "./add-connection-dialog"
import { useToast } from "@/hooks/use-toast"
import { useSearchParams } from "next/navigation"

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
    return res.json()
  })

const categories: { value: ConnectorCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "storage", label: "Storage" },
  { value: "productivity", label: "Productivity" },
  { value: "communication", label: "Communication" },
  { value: "database", label: "Database" },
  { value: "mcp", label: "MCP" },
  { value: "analytics", label: "Analytics" },
]

export function ConnectorRegistry() {
  const {
    data: connectors = [],
    isLoading: loading,
    mutate,
  } = useSWR<Connector[]>("/api/connectors", fetcher)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    const success = searchParams?.get("success")
    const error = searchParams?.get("error")
    if (success === "connected") {
      toast({
        title: "Connected successfully",
        description: "Your integration has been authorized and connected.",
      })
    } else if (error) {
      toast({
        title: "Connection failed",
        description: error,
        variant: "destructive",
      })
    }
  }, [searchParams, toast])

  const filteredConnectors = useMemo(() => {
    let filtered = connectors

    if (selectedCategory !== "all") {
      filtered = filtered.filter((c) => c.category === selectedCategory)
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    return filtered
  }, [connectors, searchQuery, selectedCategory])

  const handleConnect = (connector: Connector) => {
    setSelectedConnector(connector)
    setDialogOpen(true)
  }

  const handleConnectionAdded = () => {
    setDialogOpen(false)
    mutate()
  }

  const connectedCount = connectors.filter((c) => c.status === "connected").length
  const totalCount = connectors.length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="border-primary/20 bg-primary/10 rounded-lg border p-3">
              <CheckCircle2 className="text-primary h-6 w-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Connected</p>
              <p className="text-2xl font-bold">{connectedCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="border-border bg-muted rounded-lg border p-3">
              <Plug className="text-muted-foreground h-6 w-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Available</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="border-accent-foreground/20 bg-accent rounded-lg border p-3">
              <AlertCircle className="text-accent-foreground h-6 w-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Attention</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search connectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="w-full justify-start">
          {categories.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[220px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredConnectors.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="No connectors found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredConnectors.map((connector) => (
                <ConnectorCard key={connector.id} connector={connector} onConnect={handleConnect} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedConnector && (
        <AddConnectionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          connector={selectedConnector}
          onSuccess={handleConnectionAdded}
        />
      )}
    </div>
  )
}
