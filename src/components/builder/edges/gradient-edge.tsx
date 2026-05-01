"use client"

import { getBezierPath, type EdgeProps } from "@xyflow/react"
import { WORKFLOW_EDGE_SOURCE, WORKFLOW_EDGE_TARGET } from "@/lib/design-tokens"

const DEFAULT_SOURCE_COLOR = WORKFLOW_EDGE_SOURCE
const DEFAULT_TARGET_COLOR = WORKFLOW_EDGE_TARGET
const INTERACTION_WIDTH = 20

export function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const sourceColor = (data?.sourceColor as string) ?? DEFAULT_SOURCE_COLOR
  const targetColor = (data?.targetColor as string) ?? DEFAULT_TARGET_COLOR
  const gradientId = `gradient-${id}`

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
        className="react-flow__edge-path"
      />
    </>
  )
}
