import { describe, it, expect } from "vitest"
import {
  connectionIdsAlongNodePath,
  connectionIdsTouchingNode,
  workflowConnectionsToEdges,
} from "@/lib/builder/workflow-to-reactflow"
import type { Connection, WorkflowNode } from "@/lib/workflow-types"

const connections: Connection[] = [
  { id: "e1", sourceId: "n1", targetId: "n2" },
  { id: "e2", sourceId: "n2", targetId: "n3" },
  { id: "e3", sourceId: "n4", targetId: "n5" },
]

const nodes: WorkflowNode[] = [
  { id: "n1", type: "start", position: { x: 0, y: 0 }, data: { label: "Start" } },
  { id: "n2", type: "agent", position: { x: 100, y: 0 }, data: { label: "Agent" } },
  { id: "n3", type: "end", position: { x: 200, y: 0 }, data: { label: "End" } },
]

describe("connectionIdsTouchingNode", () => {
  it("returns edge ids where the node is source or target", () => {
    expect(connectionIdsTouchingNode(connections, "n2")).toEqual(["e1", "e2"])
  })

  it("returns empty array when the node has no connections", () => {
    expect(connectionIdsTouchingNode(connections, "missing")).toEqual([])
  })

  it("returns empty array for empty connections", () => {
    expect(connectionIdsTouchingNode([], "n1")).toEqual([])
  })
})

describe("connectionIdsAlongNodePath", () => {
  it("returns only consecutive path edges", () => {
    expect(connectionIdsAlongNodePath(connections, ["n1", "n2", "n3"])).toEqual(["e1", "e2"])
  })

  it("skips missing hops without inventing adjacency", () => {
    expect(connectionIdsAlongNodePath(connections, ["n1", "n3"])).toEqual([])
  })
})

describe("workflowConnectionsToEdges runningEdgeIds", () => {
  it("marks matching edges as animatedFlow with isRunning true", () => {
    const edges = workflowConnectionsToEdges(connections, {
      nodes,
      runningEdgeIds: ["e1", "e2"],
    })

    const e1 = edges.find((e) => e.id === "e1")
    const e2 = edges.find((e) => e.id === "e2")
    const e3 = edges.find((e) => e.id === "e3")

    expect(e1?.type).toBe("animatedFlow")
    expect(e1?.data).toMatchObject({ isRunning: true })
    expect(e2?.type).toBe("animatedFlow")
    expect(e2?.data).toMatchObject({ isRunning: true })
    expect(e3?.type).toBe("gradient")
    expect(e3?.data).toMatchObject({ isRunning: false })
  })

  it("defaults to gradient edges when runningEdgeIds is omitted", () => {
    const edges = workflowConnectionsToEdges(connections, { nodes })
    expect(edges.every((e) => e.type === "gradient")).toBe(true)
    expect(edges.every((e) => e.data?.isRunning === false)).toBe(true)
  })
})
