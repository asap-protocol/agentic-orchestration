"use client"

import { useState } from "react"
import { History, X, GitBranch, Tag, Trash2, Eye, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { WorkflowVersion } from "@/lib/workflow-types"
import useSWR from "swr"
import { EmptyState } from "@/components/ui/empty-state"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface VersionHistoryPanelProps {
  workflowId: string
  isOpen: boolean
  onToggle: () => void
  onRestoreVersion?: (version: WorkflowVersion) => void
  onSave?: () => void | Promise<void>
}

export function VersionHistoryPanel({
  workflowId,
  isOpen,
  onToggle,
  onRestoreVersion,
  onSave,
}: VersionHistoryPanelProps) {
  const { data: versions, mutate } = useSWR<WorkflowVersion[]>(
    `/api/workflows/${workflowId}/versions`,
    fetcher,
  )
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState("")

  const handleAddTag = async (versionNumber: number) => {
    if (!tagInput.trim()) return

    await fetch(`/api/workflows/${workflowId}/versions/${versionNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: tagInput }),
    })

    setTagInput("")
    mutate()
  }

  const handleDeleteVersion = async (versionNumber: number) => {
    await fetch(`/api/workflows/${workflowId}/versions/${versionNumber}`, {
      method: "DELETE",
    })
    mutate()
  }

  const handleCreateVersion = async () => {
    if (onSave) {
      await onSave()
    } else {
      await fetch(`/api/workflows/${workflowId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Manual save point" }),
      })
    }
    mutate()
  }

  if (!isOpen) return null

  return (
    <div className="bg-card/95 border-border fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l backdrop-blur-md">
      <div className="border-border flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground h-4 w-4" />
          <h2 className="font-semibold">Version History</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          aria-label="Close version history"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-border border-b p-4">
        <Button className="w-full" onClick={handleCreateVersion}>
          <GitBranch className="mr-2 h-4 w-4" />
          Save Version
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {versions?.map((version) => (
            <div
              key={version.id}
              className={cn(
                "border-border hover:bg-accent/50 cursor-pointer space-y-2 rounded-lg border p-3 transition-colors",
                selectedVersionId === version.id && "ring-primary ring-2",
              )}
              onClick={() => setSelectedVersionId(version.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium">{version.name}</h3>
                  {version.description && (
                    <p className="text-muted-foreground mt-1 text-xs">{version.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Restore version ${version.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRestoreVersion?.(version)
                    }}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-6 w-6"
                    aria-label={`Delete version ${version.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteVersion(version.version)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Calendar className="h-3 w-3" />
                {new Date(version.createdAt).toLocaleDateString()}{" "}
                {new Date(version.createdAt).toLocaleTimeString()}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{version.nodes.length} nodes</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {version.connections.length} connections
                </span>
              </div>

              {version.tags && version.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {version.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-primary/10 text-primary flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {selectedVersionId === version.id && (
                <div className="border-border flex items-center gap-2 border-t pt-2">
                  <Input
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag(version.version)}
                    className="h-7 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddTag(version.version)
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          ))}

          {(!versions || versions.length === 0) && (
            <EmptyState
              icon={History}
              title="No versions yet"
              description="Save your first version to track changes."
              actionLabel="Save Version"
              onAction={handleCreateVersion}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
