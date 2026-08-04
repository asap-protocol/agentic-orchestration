// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useBuilderGraphMutations } from "@/components/builder/hooks/use-builder-graph-mutations"
import type { Workflow } from "@/lib/workflow-types"

const workflow: Workflow = {
  id: "wf-1",
  name: "Test",
  description: "",
  nodes: [{ id: "n1", type: "agent", position: { x: 0, y: 0 }, data: { label: "A" } }],
  connections: [],
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("useBuilderGraphMutations", () => {
  const safeFetch = vi.fn()
  const saveToHistory = vi.fn()
  const mutateWorkflow = vi.fn()
  const toast = vi.fn()
  const onNodesChange = vi.fn()
  const onEdgesChange = vi.fn()
  const screenToFlowPosition = vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y }))

  beforeEach(() => {
    vi.clearAllMocks()
    safeFetch.mockResolvedValue({ ok: true })
  })

  it("skips node delete while undo/restore PATCH is in flight", async () => {
    const { result } = renderHook(() =>
      useBuilderGraphMutations({
        workflowId: "wf-1",
        workflow,
        edges: [],
        isHistoryTransitioning: true,
        saveToHistory,
        mutateWorkflow,
        safeFetch,
        toast,
        screenToFlowPosition,
        onNodesChange,
        onEdgesChange,
      }),
    )

    await act(async () => {
      await result.current.handleNodeDeleteById("n1")
    })

    expect(safeFetch).not.toHaveBeenCalled()
  })

  it("deletes node when history transition is idle", async () => {
    const { result } = renderHook(() =>
      useBuilderGraphMutations({
        workflowId: "wf-1",
        workflow,
        edges: [],
        isHistoryTransitioning: false,
        saveToHistory,
        mutateWorkflow,
        safeFetch,
        toast,
        screenToFlowPosition,
        onNodesChange,
        onEdgesChange,
      }),
    )

    await act(async () => {
      await result.current.handleNodeDeleteById("n1")
    })

    expect(safeFetch).toHaveBeenCalledWith(
      "/api/workflows/wf-1/nodes/n1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
