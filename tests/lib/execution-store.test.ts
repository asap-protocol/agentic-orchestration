import { describe, it, expect, vi, beforeEach } from "vitest"
import type { WorkflowExecution } from "@/lib/workflow-types"
import { executionStore } from "@/lib/execution-store"

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
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    }),
  ),
}))

const WORKSPACE_ID = "ws-123"
const EXECUTION_ID = "exec-456"
const WORKFLOW_ID = "wf-789"

function sampleExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: EXECUTION_ID,
    workflowId: WORKFLOW_ID,
    status: "running",
    startedAt: new Date("2025-06-01T12:00:00.000Z"),
    context: { input: "", variables: {}, messages: [] },
    logs: [],
    input: { prompt: "hello" },
    ...overrides,
  }
}

function executionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXECUTION_ID,
    workflow_id: WORKFLOW_ID,
    workspace_id: WORKSPACE_ID,
    status: "running",
    started_at: "2025-06-01T12:00:00.000Z",
    completed_at: null,
    input: { prompt: "hello" },
    result: null,
    error: null,
    steps: {
      context: { input: "", variables: {}, messages: [] },
      logs: [],
      currentNodeId: "node-1",
    },
    ...overrides,
  }
}

describe("lib/execution-store", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue(createMockChain({ data: null, error: null }))
    mockUpdate.mockReturnValue(createMockChain({ data: null, error: null }))
    mockDelete.mockReturnValue(createMockChain({ data: null, error: null }))
    mockFrom.mockImplementation((table: string) => {
      if (table === "workflow_executions") {
        return {
          insert: mockInsert,
          update: mockUpdate,
          delete: mockDelete,
          select: () => ({
            eq: () => ({
              single: () => createMockChain({ data: executionRow(), error: null }),
              order: () => createMockChain({ data: [executionRow()], error: null }),
            }),
            order: () => ({
              eq: () => createMockChain({ data: [executionRow()], error: null }),
            }),
          }),
        }
      }
      return createMockChain({ data: null, error: null })
    })
  })

  describe("addExecution", () => {
    it("inserts paused status as pending in the database", async () => {
      const execution = sampleExecution({ status: "paused" })
      await executionStore.addExecution(WORKSPACE_ID, execution)

      expect(mockFrom).toHaveBeenCalledWith("workflow_executions")
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: EXECUTION_ID,
          workspace_id: WORKSPACE_ID,
          status: "pending",
        }),
      )
    })

    it("stringifies object input before insert", async () => {
      const execution = sampleExecution({ input: { prompt: "hello" } })
      await executionStore.addExecution(WORKSPACE_ID, execution)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          input: JSON.stringify({ prompt: "hello" }),
        }),
      )
    })

    it("throws when database client is unavailable", async () => {
      const { getSupabaseServerClient } = await import("@/lib/supabase/server")
      vi.mocked(getSupabaseServerClient).mockResolvedValueOnce(null)

      await expect(
        executionStore.addExecution(WORKSPACE_ID, sampleExecution()),
      ).rejects.toThrow("Database connection required")
    })
  })

  describe("getExecution", () => {
    it("maps pending database status to paused", async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () =>
              createMockChain({
                data: executionRow({ status: "pending" }),
                error: null,
              }),
          }),
        }),
      }))

      const result = await executionStore.getExecution(EXECUTION_ID)

      expect(result?.status).toBe("paused")
    })

    it("returns undefined when supabase is unavailable", async () => {
      const { getSupabaseServerClient } = await import("@/lib/supabase/server")
      vi.mocked(getSupabaseServerClient).mockResolvedValueOnce(null)

      const result = await executionStore.getExecution(EXECUTION_ID)

      expect(result).toBeUndefined()
    })

    it("returns undefined when row is missing", async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () => createMockChain({ data: null, error: null }),
          }),
        }),
      }))

      const result = await executionStore.getExecution(EXECUTION_ID)

      expect(result).toBeUndefined()
    })
  })

  describe("getAllExecutions", () => {
    it("returns empty array when supabase is unavailable", async () => {
      const { getSupabaseServerClient } = await import("@/lib/supabase/server")
      vi.mocked(getSupabaseServerClient).mockResolvedValueOnce(null)

      const result = await executionStore.getAllExecutions(WORKSPACE_ID)

      expect(result).toEqual([])
    })
  })

  describe("updateExecution", () => {
    it("maps paused status to pending on update", async () => {
      await executionStore.updateExecution(EXECUTION_ID, { status: "paused" })

      expect(mockUpdate).toHaveBeenCalledWith({ status: "pending" })
    })
  })

  describe("deleteExecution", () => {
    it("returns true when delete succeeds", async () => {
      mockFrom.mockImplementation(() => ({
        delete: () => ({
          eq: () => createMockChain({ data: null, error: null }),
        }),
      }))

      const result = await executionStore.deleteExecution(EXECUTION_ID)

      expect(result).toBe(true)
    })

    it("returns false when supabase is unavailable", async () => {
      const { getSupabaseServerClient } = await import("@/lib/supabase/server")
      vi.mocked(getSupabaseServerClient).mockResolvedValueOnce(null)

      const result = await executionStore.deleteExecution(EXECUTION_ID)

      expect(result).toBe(false)
    })
  })
})
