import { describe, it, expect, vi, beforeEach } from "vitest"
import type { WorkflowRow } from "@/lib/db/workflow-mapper"
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  addWorkflowNode,
  updateWorkflowNode,
  deleteWorkflowNode,
  deleteWorkflowNodes,
  addWorkflowConnection,
  deleteWorkflowConnection,
} from "@/lib/db/workflows"

/** Creates a chainable mock that resolves to the given result when awaited */
function createMockChain<T>(result: { data: T; error: Error | null }) {
  const thenable = {
    then: (resolve: (v: typeof result) => void) => resolve(result),
    catch: () => thenable,
    finally: () => thenable,
    select: () => thenable,
    eq: () => thenable,
    order: () => thenable,
    single: () => thenable,
    insert: () => thenable,
    update: () => thenable,
    delete: () => thenable,
  }
  return thenable
}

const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    }),
  ),
}))

const WORKSPACE_ID = "ws-123"
const WORKFLOW_ID = "wf-456"

function workflowRow(overrides: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id: WORKFLOW_ID,
    workspace_id: WORKSPACE_ID,
    name: "Test Workflow",
    description: "A test workflow",
    version: 1,
    nodes: [],
    connections: [],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("lib/db/workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks() // Clears call history; mockReturnValue persists
  })

  describe("getWorkflows", () => {
    it("returns workflows for workspace", async () => {
      const rows = [workflowRow(), workflowRow({ id: "wf-789", name: "Other" })]
      mockFrom.mockReturnValue(createMockChain<WorkflowRow[]>({ data: rows, error: null }))

      const result = await getWorkflows(WORKSPACE_ID)

      expect(mockFrom).toHaveBeenCalledWith("workflows")
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(WORKFLOW_ID)
      expect(result[0].name).toBe("Test Workflow")
      expect(result[1].name).toBe("Other")
    })

    it("returns empty array when no workflows", async () => {
      mockFrom.mockReturnValue(createMockChain<WorkflowRow[]>({ data: [], error: null }))

      const result = await getWorkflows(WORKSPACE_ID)

      expect(result).toEqual([])
    })

    it("throws on Supabase error", async () => {
      mockFrom.mockReturnValue(
        createMockChain({ data: null, error: new Error("DB error") as unknown as Error }),
      )

      await expect(getWorkflows(WORKSPACE_ID)).rejects.toThrow("DB error")
    })
  })

  describe("getWorkflow", () => {
    it("returns workflow by id", async () => {
      const row = workflowRow()
      mockFrom.mockReturnValue(createMockChain<WorkflowRow>({ data: row, error: null }))

      const result = await getWorkflow(WORKFLOW_ID)

      expect(mockFrom).toHaveBeenCalledWith("workflows")
      expect(result).not.toBeNull()
      expect(result!.id).toBe(WORKFLOW_ID)
      expect(result!.name).toBe("Test Workflow")
    })

    it("returns null when not found", async () => {
      mockFrom.mockReturnValue(createMockChain<WorkflowRow>({ data: null as any, error: null }))

      const result = await getWorkflow("nonexistent")

      expect(result).toBeNull()
    })
  })

  describe("createWorkflow", () => {
    it("creates workflow with nodes and connections", async () => {
      const row = workflowRow({
        nodes: [{ id: "n1", type: "start", position: { x: 0, y: 0 }, data: { label: "Start" } }],
        connections: [],
      })
      mockFrom.mockReturnValue(createMockChain<WorkflowRow>({ data: row, error: null }))

      const result = await createWorkflow(WORKSPACE_ID, {
        name: "New Workflow",
        description: "Desc",
        nodes: [{ id: "n1", type: "start", position: { x: 0, y: 0 }, data: { label: "Start" } }],
        connections: [],
      })

      expect(mockFrom).toHaveBeenCalledWith("workflows")
      expect(result.id).toBe(WORKFLOW_ID)
      expect(result.nodes).toHaveLength(1)
    })

    it("throws on Supabase error", async () => {
      mockFrom.mockReturnValue(
        createMockChain({ data: null, error: new Error("Insert failed") as unknown as Error }),
      )

      await expect(
        createWorkflow(WORKSPACE_ID, {
          name: "X",
          description: "",
          nodes: [],
          connections: [],
        }),
      ).rejects.toThrow("Insert failed")
    })
  })

  describe("updateWorkflow", () => {
    it("updates workflow fields", async () => {
      const row = workflowRow({ name: "Updated Name", description: "Updated desc" })
      mockFrom.mockReturnValue(createMockChain<WorkflowRow>({ data: row, error: null }))

      const result = await updateWorkflow(WORKFLOW_ID, {
        name: "Updated Name",
        description: "Updated desc",
      })

      expect(result.name).toBe("Updated Name")
      expect(result.description).toBe("Updated desc")
    })
  })

  describe("deleteWorkflow", () => {
    it("returns true on success", async () => {
      mockFrom.mockReturnValue(createMockChain({ data: null, error: null }))

      const result = await deleteWorkflow(WORKFLOW_ID)

      expect(result).toBe(true)
    })

    it("returns false on error", async () => {
      mockFrom.mockReturnValue(
        createMockChain({ data: null, error: new Error("Delete failed") as unknown as Error }),
      )

      const result = await deleteWorkflow(WORKFLOW_ID)

      expect(result).toBe(false)
    })
  })

  describe("addWorkflowNode", () => {
    it("adds node to workflow", async () => {
      const existingRow = workflowRow({ nodes: [], connections: [] })
      const updatedRow = workflowRow({
        nodes: [
          {
            id: "new-node-id",
            type: "agent",
            position: { x: 100, y: 100 },
            data: { label: "Agent" },
          },
        ],
        connections: [],
      })

      mockFrom
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: existingRow, error: null }))
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: updatedRow, error: null }))

      const result = await addWorkflowNode(WORKFLOW_ID, {
        type: "agent",
        position: { x: 100, y: 100 },
        data: { label: "Agent" },
      })

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].type).toBe("agent")
      expect(result.nodes[0].data.label).toBe("Agent")
    })

    it("throws when workflow not found", async () => {
      mockFrom.mockReturnValue(createMockChain<WorkflowRow>({ data: null as any, error: null }))

      await expect(
        addWorkflowNode("nonexistent", {
          type: "agent",
          position: { x: 0, y: 0 },
          data: { label: "X" },
        }),
      ).rejects.toThrow("Workflow not found")
    })
  })

  describe("updateWorkflowNode", () => {
    it("updates node in workflow", async () => {
      const nodeId = "n1"
      const existingRow = workflowRow({
        nodes: [
          {
            id: nodeId,
            type: "agent",
            position: { x: 0, y: 0 },
            data: { label: "Old" },
          },
        ],
        connections: [],
      })
      const updatedRow = workflowRow({
        nodes: [
          {
            id: nodeId,
            type: "agent",
            position: { x: 50, y: 50 },
            data: { label: "Updated" },
          },
        ],
        connections: [],
      })

      mockFrom
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: existingRow, error: null }))
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: updatedRow, error: null }))

      const result = await updateWorkflowNode(WORKFLOW_ID, nodeId, {
        position: { x: 50, y: 50 },
        data: { label: "Updated" },
      })

      expect(result.nodes[0].data.label).toBe("Updated")
    })
  })

  describe("deleteWorkflowNode", () => {
    it("removes node and its connections", async () => {
      const nodeId = "n1"
      const existingRow = workflowRow({
        nodes: [
          { id: nodeId, type: "agent", position: { x: 0, y: 0 }, data: { label: "A" } },
          { id: "n2", type: "end", position: { x: 100, y: 0 }, data: { label: "B" } },
        ],
        connections: [{ id: "c1", sourceId: nodeId, targetId: "n2" }],
      })
      const updatedRow = workflowRow({
        nodes: [{ id: "n2", type: "end", position: { x: 100, y: 0 }, data: { label: "B" } }],
        connections: [],
      })

      mockFrom
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: existingRow, error: null }))
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: updatedRow, error: null }))

      const result = await deleteWorkflowNode(WORKFLOW_ID, nodeId)

      expect(result.nodes).toHaveLength(1)
      expect(result.connections).toHaveLength(0)
    })
  })

  describe("deleteWorkflowNodes", () => {
    it("removes multiple nodes and their connections in one update", async () => {
      const existingRow = workflowRow({
        nodes: [
          { id: "n1", type: "agent", position: { x: 0, y: 0 }, data: { label: "A" } },
          { id: "n2", type: "agent", position: { x: 100, y: 0 }, data: { label: "B" } },
          { id: "n3", type: "end", position: { x: 200, y: 0 }, data: { label: "C" } },
        ],
        connections: [
          { id: "c1", sourceId: "n1", targetId: "n2" },
          { id: "c2", sourceId: "n2", targetId: "n3" },
        ],
      })
      const updatedRow = workflowRow({
        nodes: [{ id: "n3", type: "end", position: { x: 200, y: 0 }, data: { label: "C" } }],
        connections: [],
      })

      mockFrom
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: existingRow, error: null }))
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: updatedRow, error: null }))

      const result = await deleteWorkflowNodes(WORKFLOW_ID, ["n1", "n2"])

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].id).toBe("n3")
      expect(result.connections).toHaveLength(0)
    })
  })

  describe("addWorkflowConnection", () => {
    it("adds connection between nodes", async () => {
      const existingRow = workflowRow({
        nodes: [
          { id: "n1", type: "start", position: { x: 0, y: 0 }, data: { label: "S" } },
          { id: "n2", type: "end", position: { x: 100, y: 0 }, data: { label: "E" } },
        ],
        connections: [],
      })
      const updatedRow = workflowRow({
        nodes: existingRow.nodes,
        connections: [{ id: "conn-1", sourceId: "n1", targetId: "n2" }],
      })

      mockFrom
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: existingRow, error: null }))
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: updatedRow, error: null }))

      const result = await addWorkflowConnection(WORKFLOW_ID, {
        sourceId: "n1",
        targetId: "n2",
      })

      expect(result.connections).toHaveLength(1)
      expect(result.connections[0].sourceId).toBe("n1")
      expect(result.connections[0].targetId).toBe("n2")
    })

    it("throws when connection already exists", async () => {
      const existingRow = workflowRow({
        nodes: [],
        connections: [{ id: "c1", sourceId: "n1", targetId: "n2" }],
      })

      mockFrom.mockReturnValue(createMockChain<WorkflowRow>({ data: existingRow, error: null }))

      await expect(
        addWorkflowConnection(WORKFLOW_ID, { sourceId: "n1", targetId: "n2" }),
      ).rejects.toThrow("Connection already exists")
    })
  })

  describe("deleteWorkflowConnection", () => {
    it("removes connection by id", async () => {
      const connId = "c1"
      const existingRow = workflowRow({
        nodes: [],
        connections: [{ id: connId, sourceId: "n1", targetId: "n2" }],
      })
      const updatedRow = workflowRow({ nodes: [], connections: [] })

      mockFrom
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: existingRow, error: null }))
        .mockReturnValueOnce(createMockChain<WorkflowRow>({ data: updatedRow, error: null }))

      const result = await deleteWorkflowConnection(WORKFLOW_ID, connId)

      expect(result.connections).toHaveLength(0)
    })
  })
})
