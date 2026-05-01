"use client"

import {
  Bot,
  Shield,
  GitBranch,
  Plug,
  UserCheck,
  FileSearch,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { NodeType } from "@/lib/workflow-types"
import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface NodeSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onAddNode: (type: NodeType) => void
}

const NODE_CATEGORIES = [
  {
    name: "Flow",
    nodes: [
      {
        type: "start" as NodeType,
        label: "Start",
        icon: Play,
        color: "emerald",
        description: "Entry point of workflow",
      },
      {
        type: "end" as NodeType,
        label: "End",
        icon: Square,
        color: "rose",
        description: "Terminal node",
      },
    ],
  },
  {
    name: "Core",
    nodes: [
      {
        type: "agent" as NodeType,
        label: "Agent",
        icon: Bot,
        color: "blue",
        description: "AI agent with tools",
      },
      {
        type: "condition" as NodeType,
        label: "Condition",
        icon: GitBranch,
        color: "purple",
        description: "Branch workflow logic",
      },
    ],
  },
  {
    name: "Safety",
    nodes: [
      {
        type: "guardrail" as NodeType,
        label: "Guardrail",
        icon: Shield,
        color: "amber",
        description: "Content moderation",
      },
      {
        type: "user-approval" as NodeType,
        label: "User Approval",
        icon: UserCheck,
        color: "orange",
        description: "Manual approval gate",
      },
    ],
  },
  {
    name: "Integrations",
    nodes: [
      {
        type: "mcp" as NodeType,
        label: "MCP Server",
        icon: Plug,
        color: "cyan",
        description: "External tool server",
      },
      {
        type: "file-search" as NodeType,
        label: "File Search",
        icon: FileSearch,
        color: "teal",
        description: "Search documents",
      },
    ],
  },
]

const COLOR_CLASSES: Record<string, { bg: string; icon: string; border: string }> = {
  emerald: {
    bg: "bg-primary/10",
    icon: "text-primary",
    border: "border-primary/20",
  },
  rose: {
    bg: "bg-accent",
    icon: "text-accent-foreground",
    border: "border-accent-foreground/20",
  },
  blue: {
    bg: "bg-primary/15",
    icon: "text-primary",
    border: "border-primary/20",
  },
  purple: {
    bg: "bg-accent",
    icon: "text-accent-foreground",
    border: "border-accent-foreground/20",
  },
  amber: {
    bg: "bg-muted",
    icon: "text-muted-foreground",
    border: "border-border",
  },
  orange: {
    bg: "bg-muted",
    icon: "text-muted-foreground",
    border: "border-border",
  },
  cyan: {
    bg: "bg-accent",
    icon: "text-accent-foreground",
    border: "border-accent-foreground/20",
  },
  teal: {
    bg: "bg-primary/15",
    icon: "text-primary",
    border: "border-primary/20",
  },
}

export function NodeSidebar({ isOpen, onToggle, onAddNode }: NodeSidebarProps) {
  const [search, setSearch] = useState("")
  const [hoveredNode, setHoveredNode] = useState<NodeType | null>(null)

  const searchLower = search.toLowerCase()
  const filteredCategories = useMemo(
    () =>
      NODE_CATEGORIES.map((category) => ({
        ...category,
        nodes: category.nodes.filter((node) => node.label.toLowerCase().includes(searchLower)),
      })).filter((category) => category.nodes.length > 0),
    [searchLower],
  )

  return (
    <div
      className={cn(
        "border-border/80 bg-card/90 relative z-40 border-r backdrop-blur-md transition-all duration-300",
        isOpen ? "w-72" : "w-0",
      )}
    >
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "border-border/80 bg-card text-muted-foreground absolute top-4 -right-4 z-50 h-8 w-8 rounded-full border",
          "hover:text-foreground transition-all duration-300 hover:scale-110",
        )}
        onClick={onToggle}
        aria-label={isOpen ? "Close node sidebar" : "Open node sidebar"}
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-full flex-col"
          >
            <div className="border-border/80 border-b p-5">
              <h2 className="mb-4 text-lg leading-snug font-semibold tracking-tight">Add Nodes</h2>
              <div className="group relative">
                <Search className="text-muted-foreground group-focus-within:text-primary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors" />
                <Input
                  placeholder="Search nodes..."
                  className="border-border/80 bg-background/70 placeholder:text-muted-foreground/50 h-10 rounded-xl pl-9 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search nodes"
                />
              </div>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto p-5">
              {filteredCategories.map((category) => (
                <div key={category.name}>
                  <h3 className="text-muted-foreground/70 mb-3 pl-1 text-[11px] font-semibold tracking-widest uppercase">
                    {category.name}
                  </h3>
                  <div className="space-y-2.5">
                    {category.nodes.map((node, i) => {
                      const colors = COLOR_CLASSES[node.color]
                      const isHovered = hoveredNode === node.type
                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e: React.DragEvent) => {
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({ type: node.type, label: node.label }),
                            )
                            e.dataTransfer.effectAllowed = "move"
                          }}
                        >
                          <motion.button
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: i * 0.05,
                              type: "spring",
                              stiffness: 300,
                              damping: 24,
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 transition-colors duration-300 ease-out",
                              "border-border/80 border",
                              "bg-background/70 hover:bg-accent/40",
                              "cursor-grab active:cursor-grabbing",
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onAddNode(node.type)}
                            onMouseEnter={() => setHoveredNode(node.type)}
                            onMouseLeave={() => setHoveredNode(null)}
                          >
                            <div
                              className={cn(
                                "ring-border/80 flex-shrink-0 rounded-lg p-2 ring-1 transition-all duration-500 ease-out ring-inset",
                                colors.bg,
                                isHovered && "scale-110",
                              )}
                            >
                              <node.icon
                                className={cn(
                                  "h-4 w-4 transition-transform duration-500",
                                  colors.icon,
                                  isHovered && "scale-110",
                                )}
                              />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <span className="text-foreground block text-sm font-medium tracking-tight">
                                {node.label}
                              </span>
                              {node.description && (
                                <span className="text-muted-foreground/70 mt-0.5 block truncate text-[11px]">
                                  {node.description}
                                </span>
                              )}
                            </div>
                          </motion.button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-border/80 bg-background/70 border-t p-5">
              <p className="text-muted-foreground/60 text-[11px] leading-relaxed font-light">
                Click to add at center, or drag to drop at a specific position. Connect nodes by
                dragging from output to input handles.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
