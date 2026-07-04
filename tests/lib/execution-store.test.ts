import { describe, it, expect, vi, beforeEach } from "vitest"
import type { WorkflowExecution } from "@/lib/workflow-types"
import { executionStore } from "@/lib/execution-store"

type MockResult<T> = { data: T; error: Error | null }

function createMockChain<T>(result: MockResult<T>) {
  const thenable = {
    then: (resolve: (v: MockResult<T>) => void) => resolve(result),
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
const getSupabaseServerClient = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => getSupabaseServerClient(),
}))

const WORKSPACE_ID = "ws-exec-123"
const EXECUTION_ID = "exec-456"
const WORKFLOW_ID = "wf-789"

function sampleExecution(
  overrides: Partial<WorkflowExecution> = {},
): WorkflowExecution {
  return {
    id: EXECUTION_ID,
    workflowId: WORKFLOW_ID,
    status: "paused",
    startedAt: new Date("2025-06-01T10:00:00.000Z"),
    context: {
      input: "hello",
      variables: { key: "value" },
      messages: [{ role: "user", content: "hello" }],
    },
    logs: [
      {
        id: "log-1",
        nodeId: "start",
        timestamp: new Date("2025-06-01T10:00:01.000Z"),
        type: "info",
        message: "started",
      },
    ],
    currentNodeId: "node-1",
    input: { prompt: "run workflow" },
    ...overrides,
  }
}

function executionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXECUTION_ID,
    workflow_id: WORKFLOW_ID,
    status: "pending",
    started_at: "2025-06-01T10:00:00.000Z",
    completed_at: null,
    steps: {
      currentNodeId: "node-1",
      context: {
        input: "hello",
        variables: { key: "value" },
        messages: [{ role: "user", content: "hello" }],
      },
      logs: [
        {
          id: "log-1",
          nodeId: "start",
          timestamp: "2025-06-01T10:00:01.000Z",
          type: "info",
          message: "started",
        },
      ],
    },
    input: '{"prompt":"run workflow"}',
    result: null,
    error: null,
    ...overrides,
  }
}

describe("lib/execution-store", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSupabaseServerClient.mockResolvedValue({ from: mockFrom })
  })

  describe("addExecution", () => {
    it("maps paused status to pending and serializes object input", async () => {
      let capturedInsert: Record<string, unknown> | undefined
      mockFrom.mockReturnValue({
        insert: (payload: Record<string, unknown>) => {
          capturedInsert = payload
          return createMockChain({ data: null, error: null })
        },
      })

      const execution = sampleExecution()
      await executionStore.addExecution(WORKSPACE_ID, execution)

      expect(mockFrom).toHaveBeenCalledWith("workflow_executions")
      expect(capturedInsert).toMatchObject({
        id: EXECUTION_ID,
        workspace_id: WORKSPACE_ID,
        workflow_id: WORKFLOW_ID,
        status: "pending",
        input: JSON.stringify({ prompt: "run workflow" }),
        steps: {
          context: execution.context,
          logs: execution.logs,
          currentNodeId: "node-1",
        },
      })
    })

    it("throws when database client is unavailable", async () => {
      getSupabaseServerClient.mockResolvedValue(null)

      await expect(
        executionStore.addExecution(WORKSPACE_ID, sampleExecution()),
      ).rejects.toThrow("Database connection required")
    })
  })

  describe("getExecution", () => {
    it("maps pending row status back to paused and parses dates", async () => {
      mockFrom.mockReturnValue(
        createMockChain({ data: executionRow(), error: null }),
      )

      const result = await executionStore.getExecution(EXECUTION_ID)

      expect(mockFrom).toHaveBeenCalledWith("workflow_executions")
      expect(result).toBeDefined()
      expect(result?.status).toBe("paused")
      expect(result?.startedAt).toBeInstanceOf(Date)
      expect(result?.context.input).toBe("hello")
      expect(result?.logs).toHaveLength(1)
      expect(result?.currentNodeId).toBe("node-1")
    })

    it("returns undefined when database client is unavailable", async () => {
      getSupabaseServerClient.mockResolvedValue(null)

      const result = await executionStore.getExecution(EXECUTION_ID)

      expect(result).toBeUndefined()
    })

    it("defaults missing steps context to empty execution context", async () => {
      mockFrom.mockReturnValue(
        createMockChain({
          data: executionRow({ steps: { logs: [] } }),
          error: null,
        }),
      )

      const result = await executionStore.getExecution(EXECUTION_ID)

      expect(result?.context).toEqual({
        input: "",
        variables: {},
        messages: [],
      })
      expect(result?.logs).toEqual([])
    })
  })

  describe("getAllExecutions", () => {
    it("returns empty array when database client is unavailable", async () => {
      getSupabaseServerClient.mockResolvedValue(null)

      const result = await executionStore.getAllExecutions(WORKSPACE_ID)

      expect(result).toEqual([])
    })
  })

  describe("updateExecution", () => {
    it("merges steps without clobbering existing context and maps paused to pending", async () => {
      let capturedUpdate: Record<string, unknown> | undefined
      const existingSteps = {
        context: { input: "keep-me", variables: {}, messages: [] },
        logs: [{ id: "old-log", nodeId: "n1", timestamp: "t", type: "info", message: "old" }],
        currentNodeId: "n1",
      }

      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: { steps: existingSteps }, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            capturedUpdate = payload
            expect(id).toBe(EXECUTION_ID)
            return createMockChain({ data: null, error: null })
          },
        }),
      }))

      const newLog = {
        id: "log-2",
        nodeId: "n2",
        timestamp: new Date("2025-06-01T10:05:00.000Z"),
        type: "success" as const,
        message: "node complete",
      }

      await executionStore.updateExecution(EXECUTION_ID, {
        status: "paused",
        logs: [newLog],
        currentNodeId: "n2",
      })

      expect(capturedUpdate).toMatchObject({
        status: "pending",
        steps: {
          context: existingSteps.context,
          logs: [newLog],
          currentNodeId: "n2",
        },
      })
    })
  })

  describe("deleteExecution", () => {
    it("returns false when database client is unavailable", async () => {
      getSupabaseServerClient.mockResolvedValue(null)

      const deleted = await executionStore.deleteExecution(EXECUTION_ID)

      expect(deleted).toBe(false)
    })
  })
})
