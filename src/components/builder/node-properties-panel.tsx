"use client"

import {
  type LucideIcon,
  Bot,
  Shield,
  GitBranch,
  Plug,
  UserCheck,
  FileSearch,
  Play,
  Square,
  Frame,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { WorkflowNode, NodeType } from "@/lib/workflow-types"
import { useState, useEffect } from "react"

interface NodePropertiesPanelProps {
  isOpen: boolean
  onToggle: () => void
  node: WorkflowNode | undefined
  workflowId: string
  /** Snapshot pre-edit workflow into undo history before persisting property changes. */
  onBeforeSave?: () => void
  onUpdate: () => void
}

const NODE_ICONS: Record<NodeType, LucideIcon> = {
  start: Play,
  end: Square,
  agent: Bot,
  guardrail: Shield,
  condition: GitBranch,
  mcp: Plug,
  "user-approval": UserCheck,
  "file-search": FileSearch,
  frame: Frame,
}

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
]

const GUARDRAIL_TYPES = [
  { value: "jailbreak", label: "Jailbreak Detection" },
  { value: "pii", label: "PII Masking" },
  { value: "custom", label: "Custom Rules" },
]

export function NodePropertiesPanel({
  isOpen,
  onToggle,
  node,
  workflowId,
  onBeforeSave,
  onUpdate,
}: NodePropertiesPanelProps) {
  const [formData, setFormData] = useState<WorkflowNode["data"]>(node?.data || { label: "" })

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (node) {
      setFormData(node.data)
    }
  }, [node])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = async () => {
    if (!node) return

    onBeforeSave?.()

    await fetch(`/api/workflows/${workflowId}/nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formData }),
    })
    onUpdate()
  }

  const Icon = node ? NODE_ICONS[node.type] : Settings2

  return (
    <div
      className={cn(
        "border-border/80 bg-card/90 relative z-40 border-l backdrop-blur-md transition-all duration-300",
        isOpen ? "w-80" : "w-0",
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "border-border/80 bg-card text-muted-foreground absolute top-4 -left-4 z-50 h-8 w-8 rounded-full border",
          "hover:text-foreground transition-all duration-300 hover:scale-110",
        )}
        onClick={onToggle}
        aria-label={isOpen ? "Close properties panel" : "Open properties panel"}
      >
        {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {isOpen && (
        <div className="flex h-full flex-col">
          {node ? (
            <>
              {/* Header */}
              <div className="border-border/80 border-b p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-muted/40 ring-border/80 rounded-xl p-2.5 ring-1 ring-inset">
                    {Icon && <Icon className="text-foreground h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="text-foreground leading-snug font-semibold tracking-tight">
                      {node.data.label}
                    </h2>
                    <p className="text-muted-foreground/70 mt-0.5 text-[11px] font-medium tracking-widest uppercase">
                      {node.type} Node
                    </p>
                  </div>
                </div>
              </div>

              {/* Properties Form */}
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {/* Label (all nodes) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="label"
                    className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase"
                  >
                    Label
                  </Label>
                  <Input
                    id="label"
                    value={formData.label}
                    className="border-border/80 bg-background/70 rounded-xl text-sm"
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  />
                </div>

                {/* Description (all nodes) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="border-border/80 bg-background/70 resize-none rounded-xl text-sm"
                  />
                </div>

                {/* Agent-specific fields */}
                {node.type === "agent" && (
                  <>
                    <div className="space-y-2">
                      <Label
                        htmlFor="model"
                        id="model-label"
                        className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase"
                      >
                        Model
                      </Label>
                      <Select
                        value={formData.model || "gpt-4o"}
                        onValueChange={(value) => setFormData({ ...formData, model: value })}
                      >
                        <SelectTrigger
                          id="model"
                          aria-labelledby="model-label"
                          className="border-border/80 bg-background/70 rounded-xl text-sm"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border/80 bg-popover rounded-xl">
                          {MODELS.map((model) => (
                            <SelectItem
                              key={model.value}
                              value={model.value}
                              className="cursor-pointer rounded-lg"
                            >
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="systemPrompt"
                        className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase"
                      >
                        System Prompt
                      </Label>
                      <Textarea
                        id="systemPrompt"
                        value={formData.systemPrompt || ""}
                        onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                        rows={4}
                        placeholder="You are a helpful assistant..."
                        className="border-border/80 bg-background/70 resize-none rounded-xl text-sm"
                      />
                    </div>
                  </>
                )}

                {/* Guardrail-specific fields */}
                {node.type === "guardrail" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="guardrailType"
                      className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase"
                    >
                      Guardrail Type
                    </Label>
                    <Select
                      value={formData.guardrailType || "jailbreak"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          guardrailType: value as "jailbreak" | "pii" | "custom",
                        })
                      }
                    >
                      <SelectTrigger className="border-border/80 bg-background/70 rounded-xl text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border/80 bg-popover rounded-xl">
                        {GUARDRAIL_TYPES.map((type) => (
                          <SelectItem
                            key={type.value}
                            value={type.value}
                            className="cursor-pointer rounded-lg"
                          >
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Condition-specific fields */}
                {node.type === "condition" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="condition"
                      className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase"
                    >
                      Condition Expression
                    </Label>
                    <Textarea
                      id="condition"
                      value={formData.condition || ""}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      rows={3}
                      placeholder="e.g., intent === 'support'"
                      className="border-border/80 bg-muted/30 text-muted-foreground/90 resize-none rounded-xl font-mono text-sm"
                    />
                  </div>
                )}

                {/* MCP-specific fields */}
                {node.type === "mcp" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="mcpServer"
                      className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase"
                    >
                      MCP Server URL
                    </Label>
                    <Input
                      id="mcpServer"
                      value={formData.mcpServer || ""}
                      onChange={(e) => setFormData({ ...formData, mcpServer: e.target.value })}
                      placeholder="https://mcp.example.com"
                      className="border-border/80 bg-background/70 rounded-xl text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-border/80 bg-background/70 border-t p-5">
                <Button className="w-full rounded-xl" onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="border-border/80 bg-muted/30 mb-4 rounded-full border p-4">
                <Settings2 className="text-muted-foreground/40 h-8 w-8" />
              </div>
              <h3 className="text-foreground mb-1 font-medium tracking-tight">No Node Selected</h3>
              <p className="text-muted-foreground/60 max-w-[200px] text-[13px] leading-relaxed">
                Click a node on the canvas to configure its properties here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
