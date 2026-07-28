import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Workflow, WorkflowNode } from "@/lib/workflow-types"

const { mockFrom, mockGetSupabase } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetSupabase: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => mockGetSupabase(),
}))

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

/** Chainable thenable mock for Supabase query builders */
function createMockChain<T>(result: { data: T; error: { message: string; code?: string } | null }) {
  const thenable = {
    then: (resolve: (v: typeof result) => void) => resolve(result),
    catch: () => thenable,
    finally: () => thenable,
    select: () => thenable,
    eq: () => thenable,
    order: () => thenable,
    single: () => thenable,
    maybeSingle: () => thenable,
    insert: () => thenable,
    update: () => thenable,
    delete: () => thenable,
  }
  return thenable
}

describe("versionStore (memory fallback)", () => {
  beforeEach(async () => {
    vi.resetModules()
    mockGetSupabase.mockResolvedValue(null)
    mockFrom.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("creates and lists versions in-memory when Supabase is unavailable", async () => {
    const { versionStore } = await import("@/lib/version-store")
    const workflow = makeWorkflow({ nodes: [makeNode("n1")] })

    const created = await versionStore.createVersion(workflow, "checkpoint")
    expect(created.workflowId).toBe("wf-1")
    expect(created.nodes).toEqual([makeNode("n1")])
    expect(created.description).toBe("checkpoint")

    const listed = await versionStore.getVersions("wf-1")
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(created.id)
  })

  it("getVersion returns the matching snapshot for restore", async () => {
    const { versionStore } = await import("@/lib/version-store")
    const snapshot = makeWorkflow({ nodes: [makeNode("saved")], connections: [] })
    const created = await versionStore.createVersion(snapshot)

    const loaded = await versionStore.getVersion("wf-1", created.version)
    expect(loaded?.nodes).toEqual([makeNode("saved")])
    expect(loaded?.connections).toEqual([])
  })

  it("deleteVersion removes a version from memory", async () => {
    const { versionStore } = await import("@/lib/version-store")
    const created = await versionStore.createVersion(makeWorkflow())
    expect(await versionStore.deleteVersion("wf-1", created.version)).toBe("ok")
    expect(await versionStore.getVersions("wf-1")).toHaveLength(0)
  })

  it("tagVersion appends a tag in memory", async () => {
    const { versionStore } = await import("@/lib/version-store")
    const created = await versionStore.createVersion(makeWorkflow())
    expect(await versionStore.tagVersion("wf-1", created.version, "stable")).toBe("ok")
    const loaded = await versionStore.getVersion("wf-1", created.version)
    expect(loaded?.tags).toContain("stable")
  })

  it("compareVersions reports added and removed nodes", async () => {
    const { versionStore } = await import("@/lib/version-store")
    const v1 = await versionStore.createVersion(makeWorkflow({ nodes: [makeNode("a")] }))
    const v2 = await versionStore.createVersion(
      makeWorkflow({ version: 2, nodes: [makeNode("a"), makeNode("b")] }),
    )

    const comparison = await versionStore.compareVersions("wf-1", v1.version, v2.version)
    expect(comparison?.added.nodes.map((n) => n.id)).toEqual(["b"])
    expect(comparison?.removed.nodes).toEqual([])
  })

  it("throws in production when Supabase client is null", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { versionStore } = await import("@/lib/version-store")
    await expect(versionStore.createVersion(makeWorkflow())).rejects.toThrow(
      /Database connection is required for workflow versions in production/,
    )
  })
})

describe("versionStore (Supabase persistence)", () => {
  beforeEach(async () => {
    vi.resetModules()
    mockFrom.mockReset()
    mockGetSupabase.mockReset()
    mockGetSupabase.mockResolvedValue({ from: mockFrom })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("inserts into workflow_versions when Supabase is available", async () => {
    const row = {
      id: "ver-1",
      workflow_id: "wf-1",
      version: 1,
      nodes: [makeNode("n1")],
      connections: [],
      tag: null,
      description: "Manual save",
      created_at: "2026-01-01T00:00:00.000Z",
    }
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ data: row, error: null }))

    const { versionStore } = await import("@/lib/version-store")
    const created = await versionStore.createVersion(
      makeWorkflow({ nodes: [makeNode("n1")] }),
      "Manual save",
    )

    expect(mockFrom).toHaveBeenCalledWith("workflow_versions")
    expect(created.id).toBe("ver-1")
    expect(created.nodes).toEqual([makeNode("n1")])
    expect(created.description).toBe("Manual save")
  })

  it("retries createVersion on unique version conflicts", async () => {
    const row = {
      id: "ver-2",
      workflow_id: "wf-1",
      version: 2,
      nodes: [],
      connections: [],
      tag: null,
      description: null,
      created_at: "2026-01-01T00:00:00.000Z",
    }
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(
        createMockChain({ data: null, error: { message: "duplicate", code: "23505" } }),
      )
      .mockReturnValueOnce(
        createMockChain({
          data: [{ ...row, version: 1, id: "ver-1" }],
          error: null,
        }),
      )
      .mockReturnValueOnce(createMockChain({ data: row, error: null }))

    const { versionStore } = await import("@/lib/version-store")
    const created = await versionStore.createVersion(makeWorkflow())
    expect(created.version).toBe(2)
  })

  it("lists versions from workflow_versions ordered by version desc", async () => {
    const rows = [
      {
        id: "ver-2",
        workflow_id: "wf-1",
        version: 2,
        nodes: [],
        connections: [],
        tag: '["prod"]',
        description: null,
        created_at: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "ver-1",
        workflow_id: "wf-1",
        version: 1,
        nodes: [],
        connections: [],
        tag: null,
        description: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]
    mockFrom.mockReturnValue(createMockChain({ data: rows, error: null }))

    const { versionStore } = await import("@/lib/version-store")
    const listed = await versionStore.getVersions("wf-1")

    expect(mockFrom).toHaveBeenCalledWith("workflow_versions")
    expect(listed.map((v) => v.version)).toEqual([2, 1])
    expect(listed[0].tags).toEqual(["prod"])
    expect(listed[0].name).toBe("v2")
  })

  it("getVersion returns undefined only for true no-row errors", async () => {
    mockFrom.mockReturnValueOnce(
      createMockChain({ data: null, error: { message: "no rows", code: "PGRST116" } }),
    )
    const { versionStore } = await import("@/lib/version-store")
    await expect(versionStore.getVersion("wf-1", 9)).resolves.toBeUndefined()
  })

  it("getVersion throws on unexpected database errors", async () => {
    mockFrom.mockReturnValueOnce(
      createMockChain({ data: null, error: { message: "connection reset", code: "57P01" } }),
    )
    const { versionStore } = await import("@/lib/version-store")
    await expect(versionStore.getVersion("wf-1", 1)).rejects.toThrow(/connection reset/)
  })

  it("tagVersion returns forbidden when update affects zero rows", async () => {
    const existing = {
      id: "ver-1",
      workflow_id: "wf-1",
      version: 1,
      nodes: [],
      connections: [],
      tag: null,
      description: null,
      created_at: "2026-01-01T00:00:00.000Z",
    }
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: existing, error: null }))
      .mockReturnValueOnce(createMockChain({ data: null, error: null }))

    const { versionStore } = await import("@/lib/version-store")
    await expect(versionStore.tagVersion("wf-1", 1, "stable")).resolves.toBe("forbidden")
  })

  it("deleteVersion returns ok when a row is deleted", async () => {
    const existing = {
      id: "ver-1",
      workflow_id: "wf-1",
      version: 1,
      nodes: [],
      connections: [],
      tag: null,
      description: null,
      created_at: "2026-01-01T00:00:00.000Z",
    }
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: existing, error: null }))
      .mockReturnValueOnce(createMockChain({ data: { id: "ver-1" }, error: null }))

    const { versionStore } = await import("@/lib/version-store")
    await expect(versionStore.deleteVersion("wf-1", 1)).resolves.toBe("ok")
  })
})
