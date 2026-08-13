import { describe, it, expect, vi, beforeEach } from "vitest"
import type { WorkflowExecution } from "@/lib/workflow-types"

const { mockGetSupabase } = vi.hoisted(() => ({
  mockGetSupabase: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => mockGetSupabase(),
}))

import { executionStore } from "@/lib/execution-store"

type WriteResult = { data: unknown; error: { message: string } | null }

function createMockChain(options: {
  selectData?: { steps?: Record<string, unknown> } | null
  writeError?: { message: string } | null
}) {
  const inFn = vi.fn()
  const updateFn = vi.fn()
  const chain: Record<string, unknown> = {}

  const writeResult = (): WriteResult => ({
    data: null,
    error: options.writeError ?? null,
  })

  Object.assign(chain, {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    single: () => Promise.resolve({ data: options.selectData ?? { steps: {} }, error: null }),
    insert: () => chain,
    update: (...args: unknown[]) => {
      updateFn(...args)
      return chain
    },
    in: (...args: unknown[]) => {
      inFn(...args)
      return chain
    },
    delete: () => chain,
    then: (resolve: (value: WriteResult) => void) => resolve(writeResult()),
    catch: () => chain,
    finally: () => chain,
  })

  return { chain, inFn, updateFn }
}

function runningExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    status: "running",
    startedAt: new Date("2026-08-13T11:00:00.000Z"),
    context: { input: "hello", variables: {}, messages: [] },
    logs: [],
    ...overrides,
  }
}

describe("executionStore.updateExecution", () => {
  beforeEach(() => {
    mockGetSupabase.mockReset()
  })

  it("constrains running patches to non-terminal rows so a late write cannot clobber completed", async () => {
    const { chain, inFn, updateFn } = createMockChain({})
    mockGetSupabase.mockResolvedValue({ from: () => chain })

    await executionStore.updateExecution("exec-1", runningExecution())

    expect(updateFn).toHaveBeenCalled()
    expect(inFn).toHaveBeenCalledWith("status", ["running", "pending"])
  })

  it("constrains paused (pending) patches the same way as running", async () => {
    const { chain, inFn } = createMockChain({})
    mockGetSupabase.mockResolvedValue({ from: () => chain })

    await executionStore.updateExecution("exec-1", runningExecution({ status: "paused" }))

    expect(inFn).toHaveBeenCalledWith("status", ["running", "pending"])
  })

  it("does not constrain a completed patch, so the terminal snapshot can persist", async () => {
    const { chain, inFn, updateFn } = createMockChain({})
    mockGetSupabase.mockResolvedValue({ from: () => chain })

    await executionStore.updateExecution(
      "exec-1",
      runningExecution({
        status: "completed",
        completedAt: new Date("2026-08-13T11:01:00.000Z"),
        logs: [
          { id: "l1", nodeId: "end", timestamp: new Date(), type: "success", message: "done" },
        ],
      }),
    )

    expect(updateFn).toHaveBeenCalled()
    expect(inFn).not.toHaveBeenCalled()
  })

  it("throws when supabase returns an update error, including id and message", async () => {
    const { chain } = createMockChain({ writeError: { message: "rls denied" } })
    mockGetSupabase.mockResolvedValue({ from: () => chain })

    await expect(executionStore.updateExecution("exec-1", runningExecution())).rejects.toThrow(
      /exec-1.*rls denied/,
    )
  })
})

describe("executionStore.addExecution", () => {
  beforeEach(() => {
    mockGetSupabase.mockReset()
  })

  it("throws when supabase returns an insert error, including id and message", async () => {
    const { chain } = createMockChain({ writeError: { message: "duplicate key" } })
    mockGetSupabase.mockResolvedValue({ from: () => chain })

    await expect(executionStore.addExecution("ws-1", runningExecution())).rejects.toThrow(
      /exec-1.*duplicate key/,
    )
  })
})
