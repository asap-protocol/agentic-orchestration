"use client"

import { useState, type ReactNode } from "react"
import useSWR from "swr"
import { Search, Wrench, Globe, Database, Code, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Tool } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const categoryIcons: Record<string, ReactNode> = {
  web: <Globe className="h-5 w-5" />,
  data: <Database className="h-5 w-5" />,
  code: <Code className="h-5 w-5" />,
  utility: <Sparkles className="h-5 w-5" />,
}

const categoryColors: Record<string, string> = {
  web: "border border-primary/20 bg-primary/10 text-primary",
  data: "border border-border bg-muted text-muted-foreground",
  code: "border border-accent-foreground/20 bg-accent text-accent-foreground",
  utility: "border border-primary/20 bg-primary/10 text-primary",
}

export function ToolsLibrary() {
  const { data: tools = [], isLoading: loading } = useSWR<Tool[]>("/api/tools", fetcher)
  const [search, setSearch] = useState("")

  const filteredTools = tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase()),
  )

  const categories = ["all", "web", "data", "code", "utility"]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl leading-snug font-bold">Tools Library</h1>
        <p className="text-muted-foreground">Browse and explore available tools for your agents</p>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="capitalize">
              {cat === "all" ? "All Tools" : cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat}>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[180px] w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTools
                  .filter((tool) => cat === "all" || tool.category === cat)
                  .map((tool) => (
                    <Card
                      key={tool.id}
                      className="border-border/80 hover:border-primary/20 hover-lift transition-all duration-300"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryColors[tool.category]}`}
                          >
                            {categoryIcons[tool.category] || <Wrench className="h-5 w-5" />}
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {tool.category}
                          </Badge>
                        </div>
                        <CardTitle className="mt-3">{tool.name}</CardTitle>
                        <CardDescription>{tool.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-xs font-medium">Input Schema</p>
                          <pre className="border-border/70 bg-muted/40 overflow-auto rounded border p-2 text-xs">
                            {JSON.stringify(tool.inputSchema, null, 2)}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
