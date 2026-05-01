"use client"

import { useState } from "react"
import {
  type LucideIcon,
  Search,
  Sparkles,
  Users,
  BarChart3,
  FileText,
  Zap,
  TrendingUp,
  ArrowRight,
  LayoutTemplate,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { WorkflowTemplate } from "@/lib/workflow-templates"
import useSWR from "swr"
import { useRouter } from "next/navigation"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const categoryIcons: Record<string, LucideIcon> = {
  "customer-support": Users,
  "data-analysis": BarChart3,
  "content-creation": FileText,
  automation: Zap,
  research: Sparkles,
}

const categoryColors: Record<string, string> = {
  "customer-support": "text-primary border border-primary/20 bg-primary/10",
  "data-analysis": "text-accent-foreground border border-accent-foreground/20 bg-accent",
  "content-creation": "text-muted-foreground border border-border bg-muted",
  automation: "text-primary border border-primary/20 bg-primary/10",
  research: "text-accent-foreground border border-accent-foreground/20 bg-accent",
}

export function TemplatesLibrary() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data: allTemplates, isLoading } = useSWR<WorkflowTemplate[]>("/api/templates", fetcher)
  const { data: popularTemplates } = useSWR<WorkflowTemplate[]>(
    "/api/templates?popular=true",
    fetcher,
  )

  const filteredTemplates = allTemplates?.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = !selectedCategory || template.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const categories = [
    { id: "customer-support", label: "Customer Support" },
    { id: "data-analysis", label: "Data Analysis" },
    { id: "content-creation", label: "Content Creation" },
    { id: "automation", label: "Automation" },
    { id: "research", label: "Research" },
  ]

  const handleUseTemplate = async (templateId: string, templateName: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${templateName} (Copy)` }),
      })

      const workflow = await response.json()
      router.push(`/builder?workflow=${workflow.id}`)
    } catch (error) {
      console.error(
        "Failed to use template:",
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-border/80 bg-card/60 border-b">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="mb-2 text-3xl leading-snug font-bold">Workflow Templates</h1>
          <p className="text-muted-foreground">
            Start with pre-built workflows and customize them for your needs
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.map((category) => {
            const Icon = categoryIcons[category.id]
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="gap-2"
              >
                {Icon && <Icon className="h-4 w-4" />}
                {category.label}
              </Button>
            )
          })}
        </div>

        {/* Popular Templates */}
        {!searchQuery && !selectedCategory && (
          <div className="mb-12">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="text-primary h-5 w-5" />
              <h2 className="text-xl font-semibold">Popular Templates</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {popularTemplates?.map((template) => {
                const Icon = categoryIcons[template.category]
                return (
                  <div
                    key={template.id}
                    className="group border-border/80 bg-card hover:border-primary/40 hover-lift rounded-xl border p-6 transition-all duration-300"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className={cn("rounded-lg p-3", categoryColors[template.category])}>
                        {Icon && <Icon className="h-6 w-6" />}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {template.usageCount} uses
                      </span>
                    </div>
                    <h3 className="mb-2 font-semibold">{template.name}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
                      {template.description}
                    </p>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {template.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[11px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      className="group-hover:border-primary/60 w-full bg-transparent"
                      variant="outline"
                      onClick={() => handleUseTemplate(template.id, template.name)}
                    >
                      Use Template
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All Templates */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">
            {searchQuery || selectedCategory ? "Search Results" : "All Templates"}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[220px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTemplates?.length === 0 ? (
            <EmptyState
              icon={LayoutTemplate}
              title="No templates"
              description="Templates will appear here when available."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates?.map((template) => {
                const Icon = categoryIcons[template.category]
                return (
                  <div
                    key={template.id}
                    className="group border-border/80 bg-card hover:border-primary/40 hover-lift rounded-xl border p-6 transition-all duration-300"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className={cn("rounded-lg p-3", categoryColors[template.category])}>
                        {Icon && <Icon className="h-6 w-6" />}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {template.usageCount} uses
                      </span>
                    </div>
                    <h3 className="mb-2 font-semibold">{template.name}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
                      {template.description}
                    </p>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {template.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[11px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-transparent"
                      variant="outline"
                      onClick={() => handleUseTemplate(template.id, template.name)}
                    >
                      Use Template
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
