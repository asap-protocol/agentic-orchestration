import { describe, it, expect, vi, beforeEach } from "vitest"

import type { WorkflowExecution } from "@/lib/workflow-types"

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

const WORKSPACE_ID = "ws-abc"
const EXECUTION_ID = "exec-123"
const WORKFLOW_ID = "wf-456"

function baseExecution(
  overrides: Partial<WorkflowExecution> = {},
): WorkflowExecution {
  return {
    id: EXECUTION_ID,
    workflowId: WORKFLOW_ID,
    status: "running",
    startedAt: new Date("2025-06-01T12:00:00.000Z"),
    context: { input: "hello", variables: {}, messages: [] },
    logs: [],
    input: "hello",
    ...overrides,
  }
}

describe("executionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  async function loadStore() {
    const mod = await import("@/lib/execution-store")
    return mod.executionStore
  }

  describe("addExecution", () => {
    it("maps paused status to pending in the database insert", async () => {
      const insertSpy = vi.fn().mockReturnValue(
        createMockChain({ data: null, error: null }),
      )
      mockFrom.mockReturnValue({ insert: insertSpy })

      const executionStore = await loadStore()
      await executionStore.addExecution(
        WORKSPACE_ID,
        baseExecution({ status: "paused" }),
      )

      expect(mockFrom).toHaveBeenCalledWith("workflow_executions")
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: EXECUTION_ID,
          workspace_id: WORKSPACE_ID,
          workflow_id: WORKFLOW_ID,
          status: "pending",
        }),
      )
    })

    it("JSON-stringifies object input before insert", async () => {
      const insertSpy = vi.fn().mockReturnValue(
        createMockChain({ data: null, error: null }),
      )
      mockFrom.mockReturnValue({ insert: insertSpy })

      const executionStore = await loadStore()
      await executionStore.addExecution(
        WORKSPACE_ID,
        baseExecution({ input: { prompt: "run workflow" } }),
      )

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: JSON.stringify({ prompt: "run workflow" }),
        }),
      )
    })

    it("throws when the Supabase client is unavailable", async () => {
      const server = await import("@/lib/supabase/server")
      vi.mocked(server.getSupabaseServerClient).mockResolvedValueOnce(null)

      const executionStore = await loadStore()

      await expect(
        executionStore.addExecution(WORKSPACE_ID, baseExecution()),
      ).rejects.toThrow("Database connection required")
    })
  })

  describe("getExecution", () => {
    it("maps pending database status to paused app status", async () => {
      mockFrom.mockReturnValue(
        createMockChain({
          data: {
            id: EXECUTION_ID,
            workflow_id: WORKFLOW_ID,
            status: "pending",
            started_at: "2025-06-01T12:00:00.000Z",
            completed_at: null,
            steps: {
              currentNodeId: "node-1",
              context: { input: "x", variables: { k: 1 }, messages: [] },
              logs: [{ nodeId: "node-1", message: "started", timestamp: "t" }],
            },
            input: "x",
            result: null,
            error: null,
          },
          error: null,
        }),
      )

      const executionStore = await loadStore()
      const execution = await executionStore.getExecution(EXECUTION_ID)

      expect(execution?.status).toBe("paused")
      expect(execution?.currentNodeId).toBe("node-1")
      expect(execution?.logs).toHaveLength(1)
    })

    it("returns undefined when no row is found", async () => {
      mockFrom.mockReturnValue(
        createMockChain({ data: null, error: null }),
      )

      const executionStore = await loadStore()
      const execution = await executionStore.getExecution("missing")

      expect(execution).toBeUndefined()
    })
  })

  describe("updateExecution", () => {
    it("merges steps.context and logs without dropping unspecified fields", async () => {
      const updateSpy = vi.fn().mockReturnValue(
        createMockChain({ data: null, error: null }),
      )
      mockFrom.mockReturnValue({
        select: () =>
          createMockChain({
            data: {
              steps: {
                context: { input: "old", variables: { keep: true }, messages: [] },
                logs: [{ nodeId: "a", message: "old log", timestamp: "t0" }],
                currentNodeId: "node-a",
              },
            },
            error: null,
          }),
        update: updateSpy,
      })

      const executionStore = await loadStore()
      await executionStore.updateExecution(EXECUTION_ID, {
        context: { input: "new", variables: { keep: true }, messages: [] },
        logs: [{ nodeId: "b", message: "new log", timestamp: "t1" }],
      })

      expect(updateSpy).toHaveBeenCalledWith({
        steps: {
          context: { input: "new", variables: { keep: true }, messages: [] },
          logs: [{ nodeId: "b", message: "new log", timestamp: "t1" }],
          currentNodeId: "node-a",
        },
      })
    })
  })

  describe("deleteExecution", () => {
    it("returns true when delete succeeds", async () => {
      mockFrom.mockReturnValue(
        createMockChain({ data: null, error: null }),
      )

      const executionStore = await loadStore()
      const deleted = await executionStore.deleteExecution(EXECUTION_ID)

      expect(deleted).toBe(true)
    })

    it("returns false when delete fails", async () => {
      mockFrom.mockReturnValue(
        createMockChain({
          data: null,
          error: new Error("delete failed"),
        }),
      )

      const executionStore = await loadStore()
      const deleted = await executionStore.deleteExecution(EXECUTION_ID)

      expect(deleted).toBe(false)
    })
  })
})
