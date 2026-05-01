"use client"

import { getBezierPath, type EdgeProps } from "@xyflow/react"
import { WORKFLOW_EDGE_SOURCE, WORKFLOW_EDGE_TARGET } from "@/lib/design-tokens"
import { GradientEdge } from "./gradient-edge"

const INTERACTION_WIDTH = 20

export function AnimatedFlowEdge(props: EdgeProps) {
  const isRunning = (props.data?.isRunning as boolean) ?? false
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  })

  if (!isRunning) {
    return <GradientEdge {...props} />
  }

  const gradientId = `gradient-${props.id}`
  const sourceColor = (props.data?.sourceColor as string) ?? WORKFLOW_EDGE_SOURCE
  const targetColor = (props.data?.targetColor as string) ?? WORKFLOW_EDGE_TARGET

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={INTERACTION_WIDTH}
        className="react-flow__edge-interaction"
      />
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeDasharray="8 4"
        strokeDashoffset="0"
        className="react-flow__edge-path animate-flow-dash"
      />
    </>
  )
}
