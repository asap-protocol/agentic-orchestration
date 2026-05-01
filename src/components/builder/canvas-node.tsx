"use client"

import { useState, useEffect } from "react"
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
  Trash2,
  GripVertical,
} from "lucide-react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { cn } from "@/lib/utils"
import type { NodeType, NodeData } from "@/lib/workflow-types"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export type WorkflowNodeData = NodeData & { isHighlighted?: boolean; customOnDelete?: () => void }
export type WorkflowNodeType = Node<WorkflowNodeData, NodeType>

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

const NODE_COLORS: Record<NodeType, { bg: string; iconBg: string; border: string; icon: string }> =
  {
    start: {
      bg: "bg-card/95",
      iconBg: "bg-primary/10",
      border: "border-border/80",
      icon: "text-primary",
    },
    end: {
      bg: "bg-card/95",
      iconBg: "bg-accent",
      border: "border-border/80",
      icon: "text-accent-foreground",
    },
    agent: {
      bg: "bg-card/95",
      iconBg: "bg-primary/15",
      border: "border-border/80",
      icon: "text-primary",
    },
    guardrail: {
      bg: "bg-card/95",
      iconBg: "bg-muted",
      border: "border-border/80",
      icon: "text-muted-foreground",
    },
    condition: {
      bg: "bg-card/95",
      iconBg: "bg-accent",
      border: "border-border/80",
      icon: "text-accent-foreground",
    },
    mcp: {
      bg: "bg-card/95",
      iconBg: "bg-accent",
      border: "border-border/80",
      icon: "text-accent-foreground",
    },
    "user-approval": {
      bg: "bg-card/95",
      iconBg: "bg-muted",
      border: "border-border/80",
      icon: "text-muted-foreground",
    },
    "file-search": {
      bg: "bg-card/95",
      iconBg: "bg-primary/15",
      border: "border-border/80",
      icon: "text-primary",
    },
    frame: {
      bg: "bg-card/95",
      iconBg: "bg-muted",
      border: "border-border/80",
      icon: "text-muted-foreground",
    },
  }

export type WorkflowNodeProps = NodeProps<WorkflowNodeType>

export function CanvasNode({ data, selected, type: nodeTypeProp }: WorkflowNodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHasMounted(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  const nodeType = (nodeTypeProp ?? "agent") as NodeType

  const handleDelete = () => data?.customOnDelete?.()
  const Icon = NODE_ICONS[nodeType]
  const colors = NODE_COLORS[nodeType]
  const isHighlighted = data?.isHighlighted ?? false

  return (
    <motion.div
      initial={hasMounted ? false : { opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "w-[320px] rounded-2xl transition-shadow duration-300 ease-out",
        "border",
        colors.bg,
        colors.border,
        "hover:border-primary/40",
        selected ? "ring-primary/40 z-10 ring-2" : "",
        isHighlighted && "ring-primary/60 ring-2",
        "cursor-grab active:cursor-grabbing",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {nodeType !== "start" && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className={cn(
            "!bg-background !-left-2.5 !z-30 !h-5 !w-5 !rounded-full !border-[3px] !transition-all !duration-300",
            selected || isHovered ? "!border-primary !scale-110" : "!border-muted-foreground/40",
          )}
        />
      )}

      <div className="relative overflow-hidden rounded-2xl p-4">
        <div className="group flex items-start gap-4">
          <div
            className={cn(
              "relative flex-shrink-0 rounded-xl p-2.5 transition-all duration-500 ease-out",
              colors.iconBg,
              "ring-border/80 ring-1 ring-inset",
              selected ? "scale-105" : "group-hover:scale-105",
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-500",
                  colors.icon,
                  selected ? "scale-110" : "group-hover:scale-110",
                )}
              />
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-foreground truncate text-sm font-medium tracking-tight">
                {data?.label ?? "Node"}
              </h3>
              {isHovered && (
                <GripVertical className="text-muted-foreground/40 hover:text-foreground/80 h-4 w-4 flex-shrink-0 transition-colors" />
              )}
            </div>
            {data?.description && (
              <p className="text-muted-foreground/80 mt-1 line-clamp-2 text-[13px] leading-relaxed font-light">
                {data.description}
              </p>
            )}
          </div>

          <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {(selected || isHovered) && (
              <Button
                variant="ghost"
                size="icon"
                className="nodrag nopan border-border/80 bg-background/80 text-muted-foreground hover:border-destructive hover:bg-destructive/80 h-7 w-7 rounded-full border transition-all duration-200 hover:scale-105 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                aria-label="Delete node"
                title="Delete node"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {nodeType === "agent" && data?.model && (
          <div className="mt-4 flex items-center gap-2 pt-1">
            <span className="border-primary/20 bg-primary/10 text-primary rounded-xl border px-2.5 py-1 text-[11px] font-medium">
              {data.model}
            </span>
            {data.tools && data.tools.length > 0 && (
              <span className="border-border/80 bg-muted/30 text-muted-foreground/80 rounded-xl border px-2.5 py-1 text-[11px] font-medium">
                {data.tools.length} tool{data.tools.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {nodeType === "guardrail" && data?.guardrailType && (
          <div className="mt-4 pt-1">
            <span className="border-border bg-muted text-muted-foreground inline-block rounded-xl border px-2.5 py-1 text-[11px] font-medium">
              {data.guardrailType}
            </span>
          </div>
        )}

        {nodeType === "condition" && data?.condition && (
          <div className="mt-4 pt-1">
            <div className="border-border/80 bg-muted/30 text-muted-foreground/90 rounded-xl border px-3 py-2 font-mono text-[11px]">
              {data.condition}
            </div>
          </div>
        )}
      </div>

      {nodeType !== "end" && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className={cn(
            "!bg-background !-right-2.5 !z-30 !h-5 !w-5 !rounded-full !border-[3px] !transition-all !duration-300",
            selected || isHovered ? "!border-primary !scale-110" : "!border-muted-foreground/40",
            "cursor-crosshair",
          )}
        />
      )}
    </motion.div>
  )
}
