import { describe, it, expect, beforeEach } from "vitest"
import { HistoryManager, getHistoryManager } from "@/lib/history-manager"
import type { Workflow, WorkflowNode } from "@/lib/workflow-types"

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    name: "Test",
    description: "",
    nodes: [],
    connections: [],
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

function makeNode(id: string): WorkflowNode {
  return {
    id,
    type: "agent",
    position: { x: 0, y: 0 },
    data: { label: id },
  }
}

describe("HistoryManager", () => {
  let manager: HistoryManager

  beforeEach(() => {
    manager = new HistoryManager()
  })

  it("starts with empty undo and redo stacks", () => {
    expect(manager.canUndo()).toBe(false)
    expect(manager.canRedo()).toBe(false)
  })

  it("enables undo after saveState and restores previous graph on undo", () => {
    const empty = makeWorkflow()
    const withNode = makeWorkflow({ nodes: [makeNode("n1")] })

    manager.saveState(empty)
    expect(manager.canUndo()).toBe(true)
    expect(manager.canRedo()).toBe(false)

    const restored = manager.undo(withNode)
    expect(restored?.nodes).toEqual([])
    expect(restored?.connections).toEqual([])
    expect(manager.canUndo()).toBe(false)
    expect(manager.canRedo()).toBe(true)
  })

  it("redo restores the graph after undo", () => {
    const empty = makeWorkflow()
    const withNode = makeWorkflow({ nodes: [makeNode("n1")] })

    manager.saveState(empty)
    manager.undo(withNode)
    const redone = manager.redo(empty)

    expect(redone?.nodes).toEqual([makeNode("n1")])
    expect(manager.canUndo()).toBe(true)
    expect(manager.canRedo()).toBe(false)
  })

  it("supports multiple edits in one session", () => {
    const v0 = makeWorkflow()
    const v1 = makeWorkflow({ nodes: [makeNode("n1")] })
    const v2 = makeWorkflow({ nodes: [makeNode("n1"), makeNode("n2")] })

    manager.saveState(v0)
    manager.saveState(v1)

    expect(manager.undo(v2)?.nodes).toEqual([makeNode("n1")])
    expect(manager.undo(v1)?.nodes).toEqual([])
    expect(manager.redo(v0)?.nodes).toEqual([makeNode("n1")])
    expect(manager.redo(v1)?.nodes).toEqual([makeNode("n1"), makeNode("n2")])
  })

  it("clears redo stack when a new state is saved after undo", () => {
    const v0 = makeWorkflow()
    const v1 = makeWorkflow({ nodes: [makeNode("n1")] })
    const vAlt = makeWorkflow({ nodes: [makeNode("alt")] })

    manager.saveState(v0)
    manager.undo(v1)
    expect(manager.canRedo()).toBe(true)

    manager.saveState(vAlt)
    expect(manager.canRedo()).toBe(false)
  })

  it("returns null when undo/redo stacks are empty", () => {
    const current = makeWorkflow({ nodes: [makeNode("n1")] })
    expect(manager.undo(current)).toBeNull()
    expect(manager.redo(current)).toBeNull()
  })

  it("deep-copies saved workflows so later mutations do not corrupt history", () => {
    const snapshot = makeWorkflow({ nodes: [makeNode("n1")] })
    manager.saveState(snapshot)
    snapshot.nodes.push(makeNode("mutated"))

    const restored = manager.undo(makeWorkflow({ nodes: [makeNode("current")] }))
    expect(restored?.nodes).toEqual([makeNode("n1")])
  })
})

describe("getHistoryManager", () => {
  it("returns a stable client-side manager per workflow id", () => {
    const a = getHistoryManager("client-history-a")
    const b = getHistoryManager("client-history-a")
    const c = getHistoryManager("client-history-b")

    expect(a).toBe(b)
    expect(a).not.toBe(c)

    a.clear()
    c.clear()
  })
})
