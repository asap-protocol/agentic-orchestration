import { beforeEach, describe, expect, it, vi } from "vitest"
import { withWorkspace } from "@/lib/api/with-workspace"
import type { Workspace } from "@/lib/db/workspaces"

const { mockGetCurrentWorkspace } = vi.hoisted(() => ({
  mockGetCurrentWorkspace: vi.fn(),
}))

vi.mock("@/lib/db/workspaces", () => ({
  getCurrentWorkspace: mockGetCurrentWorkspace,
}))

describe("withWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 Unauthorized when getCurrentWorkspace resolves null", async () => {
    mockGetCurrentWorkspace.mockResolvedValue(null)

    const result = await withWorkspace()

    expect(result.workspace).toBeUndefined()
    expect(result.error).toBeDefined()
    expect(result.error!.status).toBe(401)
    await expect(result.error!.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns workspace when getCurrentWorkspace resolves a workspace", async () => {
    const workspace: Workspace = {
      id: "ws-123",
      name: "Test Workspace",
    }
    mockGetCurrentWorkspace.mockResolvedValue(workspace)

    const result = await withWorkspace()

    expect(result.error).toBeUndefined()
    expect(result.workspace).toEqual(workspace)
  })
})
