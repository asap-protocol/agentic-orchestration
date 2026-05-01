function cssVar(name: string): string {
  if (typeof document === "undefined") return ""
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const WORKFLOW_EDGE_SOURCE = "var(--workflow-edge-source)"
export const WORKFLOW_EDGE_TARGET = "var(--workflow-edge-target)"

export function resolveEdgeColor(token: string): string {
  const resolved = cssVar(token.replace("var(", "").replace(")", ""))
  return resolved || token
}
