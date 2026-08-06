// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { Node } from "@xyflow/react"
import { useBuilderGraphMutations } from "@/components/builder/hooks/use-builder-graph-mutations"
import type { WorkflowNodeData } from "@/components/builder/canvas-node"
import type { NodeType, Workflow } from "@/lib/workflow-types"

const workflow: Workflow = {
  id: "wf-1",
  name: "Test",
  description: "",
  nodes: [
    { id: "n1", type: "agent", position: { x: 0, y: 0 }, data: { label: "A" } },
    { id: "n2", type: "agent", position: { x: 200, y: 0 }, data: { label: "B" } },
  ],
  connections: [],
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function dragNode(
  id: string,
  position: { x: number; y: number },
): Node<WorkflowNodeData, NodeType> {
  return {
    id,
    type: "agent",
    position,
    data: { label: id },
  }
}

describe("useBuilderGraphMutations handleNodeDragStop", () => {
  const saveToHistory = vi.fn()
  const mutateWorkflow = vi.fn()
  const safeFetch = vi.fn()
  const toast = vi.fn()
  const onNodesChange = vi.fn()
  const onEdgesChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    safeFetch.mockResolvedValue({ ok: true })
  })

  it("batches multi-select drag stops into one workflow PATCH", async () => {
    const { result } = renderHook(() =>
      useBuilderGraphMutations({
        workflowId: "wf-1",
        workflow,
        edges: [],
        saveToHistory,
        mutateWorkflow,
        safeFetch,
        toast,
        screenToFlowPosition: (pos) => pos,
        onNodesChange,
        onEdgesChange,
      }),
    )

    act(() => {
      result.current.handleNodeDragStop(
        {} as React.MouseEvent,
        dragNode("n1", { x: 41, y: 61 }),
      )
      result.current.handleNodeDragStop(
        {} as React.MouseEvent,
        dragNode("n2", { x: 241, y: 61 }),
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(safeFetch).toHaveBeenCalledTimes(1)
    expect(safeFetch).toHaveBeenCalledWith("/api/workflows/wf-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: [
          { ...workflow.nodes[0], position: { x: 40, y: 60 } },
          { ...workflow.nodes[1], position: { x: 240, y: 60 } },
        ],
      }),
    })
    expect(saveToHistory).toHaveBeenCalledTimes(1)
    expect(saveToHistory).toHaveBeenCalledWith(workflow)
    expect(mutateWorkflow).toHaveBeenCalledWith("wf-1")
  })
})
