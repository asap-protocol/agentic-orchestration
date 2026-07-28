import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { Workflow, WorkflowVersion, VersionComparison } from "./workflow-types"

/** Row shape for public.workflow_versions (see scripts/001_create_schema.sql). */
interface WorkflowVersionRow {
  id: string
  workflow_id: string
  version: number
  nodes: unknown
  connections: unknown
  tag: string | null
  description: string | null
  created_at: string
}

/** Result of tag/delete when the caller must map HTTP status. */
export type VersionWriteResult = "ok" | "not_found" | "forbidden"

const UNIQUE_VIOLATION = "23505"
const NO_ROWS = "PGRST116"
const CREATE_VERSION_MAX_ATTEMPTS = 3

function serializeTags(tags?: string[]): string | null {
  if (!tags || tags.length === 0) return null
  return JSON.stringify(tags)
}

function parseTags(tag: string | null): string[] {
  if (!tag) return []
  try {
    const parsed: unknown = JSON.parse(tag)
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string")
    }
  } catch {
    // Plain string tag from older rows
  }
  return [tag]
}

function mapVersionRow(row: WorkflowVersionRow): WorkflowVersion {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.version,
    name: `v${row.version}`,
    description: row.description ?? undefined,
    nodes: Array.isArray(row.nodes) ? row.nodes : [],
    connections: Array.isArray(row.connections) ? row.connections : [],
    createdAt: new Date(row.created_at),
    tags: parseTags(row.tag),
  }
}

function cloneGraph<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nextVersionNumber(existing: WorkflowVersion[], workflowVersion: number): number {
  if (existing.length === 0) return Math.max(1, workflowVersion)
  return Math.max(...existing.map((v) => v.version)) + 1
}

function buildVersion(
  workflow: Workflow,
  versionNumber: number,
  description?: string,
): WorkflowVersion {
  return {
    id: crypto.randomUUID(),
    workflowId: workflow.id,
    version: versionNumber,
    name: `v${versionNumber}`,
    description,
    nodes: cloneGraph(workflow.nodes),
    connections: cloneGraph(workflow.connections),
    createdAt: new Date(),
    tags: [],
  }
}

function compareSnapshots(v1: WorkflowVersion, v2: WorkflowVersion): VersionComparison {
  const added = {
    nodes: v2.nodes.filter((n2) => !v1.nodes.find((n1) => n1.id === n2.id)),
    connections: v2.connections.filter((c2) => !v1.connections.find((c1) => c1.id === c2.id)),
  }

  const removed = {
    nodes: v1.nodes.filter((n1) => !v2.nodes.find((n2) => n2.id === n1.id)),
    connections: v1.connections.filter((c1) => !v2.connections.find((c2) => c2.id === c1.id)),
  }

  const modified = v2.nodes
    .map((n2) => {
      const n1 = v1.nodes.find((n) => n.id === n2.id)
      if (n1 && JSON.stringify(n1) !== JSON.stringify(n2)) {
        return { old: n1, new: n2 }
      }
      return null
    })
    .filter((m): m is { old: (typeof v1.nodes)[0]; new: (typeof v2.nodes)[0] } => m !== null)

  return { added, removed, modified: { nodes: modified } }
}

function requireSupabaseOrMemoryFallback() {
  // Production must not silently degrade to a process-local Map (serverless amnesia).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Database connection is required for workflow versions in production (Supabase client is null).",
    )
  }
}

function isNoRowError(error: { code?: string } | null): boolean {
  return error?.code === NO_ROWS
}

/**
 * Prefers Supabase `workflow_versions` when a server client is available.
 * Fallback: process-local Map — tests / local-dev only (throws in production).
 */
class VersionStore {
  private memoryVersions: Map<string, WorkflowVersion[]> = new Map()

  async createVersion(workflow: Workflow, description?: string): Promise<WorkflowVersion> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) {
      requireSupabaseOrMemoryFallback()
      return this.createVersionInMemory(workflow, description)
    }

    let lastErrorMessage = "unknown error"
    for (let attempt = 0; attempt < CREATE_VERSION_MAX_ATTEMPTS; attempt++) {
      const existing = await this.getVersionsFromDb(workflow.id)
      const versionNumber = nextVersionNumber(existing, workflow.version)
      const id = crypto.randomUUID()

      const { data, error } = await supabase
        .from("workflow_versions")
        .insert({
          id,
          workflow_id: workflow.id,
          version: versionNumber,
          nodes: cloneGraph(workflow.nodes),
          connections: cloneGraph(workflow.connections),
          tag: null,
          description: description ?? null,
        })
        .select()
        .single()

      if (!error && data) {
        return mapVersionRow(data as WorkflowVersionRow)
      }

      lastErrorMessage = error?.message ?? "no row returned"
      if (error?.code === UNIQUE_VIOLATION) {
        continue
      }

      throw new Error(
        `Failed to create workflow version for workflowId=${workflow.id}: ${lastErrorMessage}`,
      )
    }

    throw new Error(
      `Failed to create workflow version for workflowId=${workflow.id} after ${CREATE_VERSION_MAX_ATTEMPTS} attempts: ${lastErrorMessage}`,
    )
  }

  async getVersions(workflowId: string): Promise<WorkflowVersion[]> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) {
      requireSupabaseOrMemoryFallback()
      return this.getVersionsFromMemory(workflowId)
    }
    return this.getVersionsFromDb(workflowId)
  }

  async getVersion(
    workflowId: string,
    versionNumber: number,
  ): Promise<WorkflowVersion | undefined> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) {
      requireSupabaseOrMemoryFallback()
      return this.getVersionsFromMemory(workflowId).find((v) => v.version === versionNumber)
    }

    const { data, error } = await supabase
      .from("workflow_versions")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("version", versionNumber)
      .single()

    if (error) {
      if (isNoRowError(error)) return undefined
      throw new Error(
        `Failed to load workflow version workflowId=${workflowId} version=${versionNumber}: ${error.message}`,
      )
    }
    if (!data) return undefined
    return mapVersionRow(data as WorkflowVersionRow)
  }

  async compareVersions(
    workflowId: string,
    version1: number,
    version2: number,
  ): Promise<VersionComparison | null> {
    const v1 = await this.getVersion(workflowId, version1)
    const v2 = await this.getVersion(workflowId, version2)
    if (!v1 || !v2) return null
    return compareSnapshots(v1, v2)
  }

  async tagVersion(
    workflowId: string,
    versionNumber: number,
    tag: string,
  ): Promise<VersionWriteResult> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) {
      requireSupabaseOrMemoryFallback()
      return this.tagVersionInMemory(workflowId, versionNumber, tag) ? "ok" : "not_found"
    }

    const existing = await this.getVersion(workflowId, versionNumber)
    if (!existing) return "not_found"

    const tags = existing.tags ?? []
    if (!tags.includes(tag)) tags.push(tag)

    const { data, error } = await supabase
      .from("workflow_versions")
      .update({ tag: serializeTags(tags) })
      .eq("workflow_id", workflowId)
      .eq("version", versionNumber)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new Error(
        `Failed to tag workflow version workflowId=${workflowId} version=${versionNumber}: ${error.message}`,
      )
    }
    // Row visible via SELECT but UPDATE affected 0 rows → typically RLS denial.
    if (!data) return "forbidden"
    return "ok"
  }

  async deleteVersion(workflowId: string, versionNumber: number): Promise<VersionWriteResult> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) {
      requireSupabaseOrMemoryFallback()
      return this.deleteVersionInMemory(workflowId, versionNumber) ? "ok" : "not_found"
    }

    const existing = await this.getVersion(workflowId, versionNumber)
    if (!existing) return "not_found"

    const { data, error } = await supabase
      .from("workflow_versions")
      .delete()
      .eq("workflow_id", workflowId)
      .eq("version", versionNumber)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new Error(
        `Failed to delete workflow version workflowId=${workflowId} version=${versionNumber}: ${error.message}`,
      )
    }
    if (!data) return "forbidden"
    return "ok"
  }

  private async getVersionsFromDb(workflowId: string): Promise<WorkflowVersion[]> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return []

    const { data, error } = await supabase
      .from("workflow_versions")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("version", { ascending: false })

    if (error) {
      throw new Error(
        `Failed to list workflow versions for workflowId=${workflowId}: ${error.message}`,
      )
    }

    return ((data ?? []) as WorkflowVersionRow[]).map(mapVersionRow)
  }

  private createVersionInMemory(workflow: Workflow, description?: string): WorkflowVersion {
    const existing = this.getVersionsFromMemory(workflow.id)
    const version = buildVersion(
      workflow,
      nextVersionNumber(existing, workflow.version),
      description,
    )
    this.memoryVersions.set(workflow.id, [...existing, version])
    return version
  }

  private getVersionsFromMemory(workflowId: string): WorkflowVersion[] {
    return [...(this.memoryVersions.get(workflowId) || [])].sort((a, b) => b.version - a.version)
  }

  private tagVersionInMemory(workflowId: string, versionNumber: number, tag: string): boolean {
    const versions = this.memoryVersions.get(workflowId) || []
    const version = versions.find((v) => v.version === versionNumber)
    if (!version) return false
    if (!version.tags) version.tags = []
    if (!version.tags.includes(tag)) version.tags.push(tag)
    return true
  }

  private deleteVersionInMemory(workflowId: string, versionNumber: number): boolean {
    const versions = this.memoryVersions.get(workflowId) || []
    const filtered = versions.filter((v) => v.version !== versionNumber)
    if (filtered.length === versions.length) return false
    this.memoryVersions.set(workflowId, filtered)
    return true
  }
}

export const versionStore = new VersionStore()
