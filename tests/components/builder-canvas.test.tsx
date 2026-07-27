// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BuilderCanvas } from "@/components/builder/builder-canvas"
import { getHistoryManager } from "@/lib/history-manager"
import useSWR, { mutate } from "swr"
import type { Workflow, WorkflowNode } from "@/lib/workflow-types"

const { mockWorkflow, mockWorkflows, baseSWR, mockSetNodes, mockSetEdges } = vi.hoisted(() => {
  const node: WorkflowNode = {
    id: "n1",
    type: "agent",
    position: { x: 40, y: 40 },
    data: { label: "Agent" },
  }
  const wf: Workflow = {
    id: "wf-1",
    name: "Test Workflow",
    description: "",
    nodes: [node],
    connections: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const base = () => ({
    data: null,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  })
  return {
    mockWorkflow: wf,
    mockWorkflows: [wf],
    baseSWR: base,
    mockSetNodes: vi.fn(),
    mockSetEdges: vi.fn(),
  }
})

vi.mock("swr", () => ({
  default: vi.fn((key: string | null) => {
    if (key === "/api/workflows") {
      return { ...baseSWR(), data: mockWorkflows }
    }
    if (key?.startsWith("/api/workflows/")) {
      return { ...baseSWR(), data: mockWorkflow, isLoading: true }
    }
    return baseSWR()
  }),
  mutate: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockScreenToFlowPosition = vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y }))
const mockGetViewport = vi.fn(() => ({ x: 0, y: 0, zoom: 1 }))

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react")
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReactFlow: () => ({
      screenToFlowPosition: mockScreenToFlowPosition,
      getViewport: mockGetViewport,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      fitView: vi.fn(),
    }),
    useNodesState: (initial: unknown[]) => [initial, mockSetNodes, vi.fn()],
    useEdgesState: (initial: unknown[]) => [initial, mockSetEdges, vi.fn()],
    ReactFlow: () => <div data-testid="react-flow-mock" />,
    Background: () => null,
  }
})

const defaultSWRImpl = (key: string | null, workflowData: Workflow | null) => {
  if (key === "/api/workflows") {
    return { ...baseSWR(), data: mockWorkflows }
  }
  if (key?.startsWith("/api/workflows/")) {
    return { ...baseSWR(), data: workflowData, isLoading: true }
  }
  return baseSWR()
}

describe("BuilderCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getHistoryManager("wf-1").clear()
    vi.mocked(useSWR).mockImplementation((key) =>
      defaultSWRImpl(key as string | null, mockWorkflow),
    )
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockWorkflow,
      clone() {
        return this
      },
      text: async () => "",
    }) as unknown as typeof fetch
  })

  it("select-all marks every node and edge as selected", async () => {
    const user = userEvent.setup()
    const multiNodeWorkflow: Workflow = {
      ...mockWorkflow,
      nodes: [
        {
          id: "n1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: { label: "A" },
        },
        {
          id: "n2",
          type: "agent",
          position: { x: 120, y: 0 },
          data: { label: "B" },
        },
        {
          id: "n3",
          type: "end",
          position: { x: 240, y: 0 },
          data: { label: "End" },
        },
      ],
      connections: [
        { id: "e1", sourceId: "n1", targetId: "n2" },
        { id: "e2", sourceId: "n2", targetId: "n3" },
      ],
    }
    vi.mocked(useSWR).mockImplementation((key) =>
      defaultSWRImpl(key as string | null, multiNodeWorkflow),
    )

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByTestId("builder-toolbar")).toBeInTheDocument()
    })

    mockSetNodes.mockClear()
    mockSetEdges.mockClear()

    await user.keyboard("{Meta>}a{/Meta}")

    await waitFor(() => {
      expect(mockSetNodes).toHaveBeenCalled()
    })

    const nodesUpdater = mockSetNodes.mock.calls.at(-1)?.[0] as (
      nodes: Array<{ id: string; selected?: boolean }>,
    ) => Array<{ id: string; selected?: boolean }>
    const selectedNodes = nodesUpdater([
      { id: "n1", selected: false },
      { id: "n2", selected: false },
      { id: "n3", selected: false },
    ])
    expect(selectedNodes.every((n) => n.selected === true)).toBe(true)
    expect(selectedNodes).toHaveLength(3)

    expect(mockSetEdges).toHaveBeenCalled()
    const edgesUpdater = mockSetEdges.mock.calls.at(-1)?.[0] as (
      edges: Array<{ id: string; selected?: boolean }>,
    ) => Array<{ id: string; selected?: boolean }>
    const selectedEdges = edgesUpdater([
      { id: "e1", selected: false },
      { id: "e2", selected: false },
    ])
    expect(selectedEdges.every((e) => e.selected === true)).toBe(true)
  })

  it("does NOT show loading screen when workflow data exists but isLoading is true (revalidation)", async () => {
    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.queryByText("Loading workflow...")).not.toBeInTheDocument()
    })

    expect(screen.getByTestId("builder-toolbar")).toBeInTheDocument()
    expect(screen.getByTestId("builder-canvas")).toBeInTheDocument()
  })

  it("shows loading screen when workflow data is absent and isLoading is true", async () => {
    vi.mocked(useSWR).mockImplementation((key) => defaultSWRImpl(key as string | null, null))

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByText("Loading workflow...")).toBeInTheDocument()
    })
  })

  it("does not subscribe to server history/status for undo state", async () => {
    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByTestId("builder-toolbar")).toBeInTheDocument()
    })

    const keys = vi.mocked(useSWR).mock.calls.map(([key]) => key)
    expect(keys.some((key) => typeof key === "string" && key.includes("/history/status"))).toBe(
      false,
    )
  })

  it("disables Undo and Redo when the client history stacks are empty", async () => {
    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    })
  })

  it("enables Undo from the client HistoryManager stack (not server Map)", async () => {
    const emptyGraph = {
      ...mockWorkflow,
      nodes: [] as WorkflowNode[],
      connections: [],
    }
    getHistoryManager("wf-1").saveState(emptyGraph)

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
      expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    })
  })

  it("undo restores previous graph via PATCH and does not call server /undo", async () => {
    const user = userEvent.setup()
    const emptyGraph = {
      ...mockWorkflow,
      nodes: [] as WorkflowNode[],
      connections: [],
    }
    getHistoryManager("wf-1").saveState(emptyGraph)

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "Undo" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/workflows/wf-1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"nodes":[]'),
        }),
      )
    })

    const fetchCalls = vi.mocked(global.fetch).mock.calls.map(([url]) => String(url))
    expect(fetchCalls.some((url) => url.includes("/undo"))).toBe(false)
    expect(fetchCalls.some((url) => url.includes("/redo"))).toBe(false)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled()
    })
  })

  it("redo restores again via PATCH and does not call server /redo", async () => {
    const user = userEvent.setup()
    const emptyGraph = {
      ...mockWorkflow,
      nodes: [] as WorkflowNode[],
      connections: [],
    }
    const manager = getHistoryManager("wf-1")
    manager.saveState(emptyGraph)
    manager.undo(mockWorkflow)

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "Redo" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/workflows/wf-1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"n1"'),
        }),
      )
    })

    const fetchCalls = vi.mocked(global.fetch).mock.calls.map(([url]) => String(url))
    expect(fetchCalls.some((url) => url.includes("/redo"))).toBe(false)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
      expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    })
  })

  it("rolls back undo stacks and skips SWR mutate when PATCH fails", async () => {
    const user = userEvent.setup()
    const emptyGraph = {
      ...mockWorkflow,
      nodes: [] as WorkflowNode[],
      connections: [],
    }
    getHistoryManager("wf-1").saveState(emptyGraph)

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "persist failed" }),
      clone() {
        return this
      },
      text: async () => "",
    }) as unknown as typeof fetch

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
      expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    })

    vi.mocked(mutate).mockClear()

    await user.click(screen.getByRole("button", { name: "Undo" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/workflows/wf-1",
        expect.objectContaining({ method: "PATCH" }),
      )
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
      expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    })

    expect(mutate).not.toHaveBeenCalledWith("/api/workflows/wf-1")
    expect(getHistoryManager("wf-1").canUndo()).toBe(true)
    expect(getHistoryManager("wf-1").canRedo()).toBe(false)
  })

  it("rolls back redo stacks and skips SWR mutate when PATCH fails", async () => {
    const user = userEvent.setup()
    const emptyGraph = {
      ...mockWorkflow,
      nodes: [] as WorkflowNode[],
      connections: [],
    }
    const manager = getHistoryManager("wf-1")
    manager.saveState(emptyGraph)
    manager.undo(mockWorkflow)

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "persist failed" }),
      clone() {
        return this
      },
      text: async () => "",
    }) as unknown as typeof fetch

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled()
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    })

    vi.mocked(mutate).mockClear()

    await user.click(screen.getByRole("button", { name: "Redo" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/workflows/wf-1",
        expect.objectContaining({ method: "PATCH" }),
      )
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled()
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    })

    expect(mutate).not.toHaveBeenCalledWith("/api/workflows/wf-1")
    expect(getHistoryManager("wf-1").canRedo()).toBe(true)
    expect(getHistoryManager("wf-1").canUndo()).toBe(false)
  })

  it("restores a version by PATCHing that version's nodes/connections", async () => {
    const user = userEvent.setup()
    const versionNodes: WorkflowNode[] = [
      {
        id: "saved-node",
        type: "agent",
        position: { x: 10, y: 20 },
        data: { label: "Saved" },
      },
    ]
    const versionPayload = {
      id: "ver-1",
      workflowId: "wf-1",
      version: 1,
      name: "v1",
      description: "checkpoint",
      nodes: versionNodes,
      connections: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      tags: [],
    }

    vi.mocked(useSWR).mockImplementation((key) => {
      if (key === "/api/workflows") {
        return { ...baseSWR(), data: mockWorkflows }
      }
      if (key === "/api/workflows/wf-1/versions") {
        return { ...baseSWR(), data: [versionPayload] }
      }
      if (typeof key === "string" && key.startsWith("/api/workflows/")) {
        return { ...baseSWR(), data: mockWorkflow, isLoading: false }
      }
      return baseSWR()
    })

    render(<BuilderCanvas />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Version history" })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Version history" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore version v1" })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Restore version v1" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/workflows/wf-1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"saved-node"'),
        }),
      )
    })

    const patchCall = vi
      .mocked(global.fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url) === "/api/workflows/wf-1" &&
          typeof init === "object" &&
          init !== null &&
          "method" in init &&
          init.method === "PATCH" &&
          String(init.body).includes("saved-node"),
      )
    expect(patchCall).toBeDefined()
    const body = JSON.parse(String(patchCall?.[1]?.body))
    expect(body.nodes).toEqual(versionNodes)
    expect(body.connections).toEqual([])
  })
})
