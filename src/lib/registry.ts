import type { RegistryAgent, FetchRegistryResult } from "@/types/registry"
import { registryResponseSchema, revokedResponseSchema } from "./registry-schema"

const REGISTRY_URL =
  process.env.NEXT_PUBLIC_REGISTRY_URL ??
  "https://raw.githubusercontent.com/asap-protocol/asap-protocol/main/registry.json"

const REVOKED_URL =
  process.env.NEXT_PUBLIC_REVOKED_URL ??
  "https://raw.githubusercontent.com/asap-protocol/asap-protocol/main/revoked_agents.json"

const FETCH_TIMEOUT_MS = 5000

const DEFAULT_REGISTRY_CACHE_SECONDS = 60
const MAX_REGISTRY_CACHE_SECONDS = 3600

const REVOCATION_LIST_UNAVAILABLE_ERROR = "Security restriction: Unable to verify revocation list."

/**
 * Registry list may use short ISR; revocation must stay fresh (no time-based revalidation).
 * See ASAP raw-fetch.md — Builder evaluates registry + revoked in one flow.
 */
function getRegistryRevalidateSeconds(): number {
  const raw = process.env.NEXT_PUBLIC_REGISTRY_CACHE_SECONDS?.trim()
  if (!raw) return DEFAULT_REGISTRY_CACHE_SECONDS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_REGISTRY_CACHE_SECONDS
  }
  return Math.min(parsed, MAX_REGISTRY_CACHE_SECONDS)
}

export async function fetchRegistryAgents(): Promise<FetchRegistryResult> {
  try {
    const registryRes = await fetch(REGISTRY_URL, {
      next: { revalidate: getRegistryRevalidateSeconds() },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!registryRes.ok) {
      console.error(`Registry fetch failed: ${registryRes.status} ${registryRes.statusText}`)
      return { agents: [], error: `Failed to fetch registry (HTTP ${registryRes.status})` }
    }

    const registryJson = await registryRes.json()
    const registryParsed = registryResponseSchema.safeParse(registryJson)

    if (!registryParsed.success) {
      console.error("Registry validation failed:", registryParsed.error.flatten())
      return { agents: [], error: "Invalid registry data format" }
    }

    let revokedIds: Set<string>
    try {
      const revokedRes = await fetch(REVOKED_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!revokedRes.ok) {
        console.error("Revoked list fetch failed:", revokedRes.status, revokedRes.statusText)
        return { agents: [], error: REVOCATION_LIST_UNAVAILABLE_ERROR }
      }
      const revokedJson = await revokedRes.json()
      const revokedParsed = revokedResponseSchema.safeParse(revokedJson)
      if (!revokedParsed.success) {
        console.error("Revoked list validation failed:", revokedParsed.error.flatten())
        return { agents: [], error: REVOCATION_LIST_UNAVAILABLE_ERROR }
      }
      revokedIds = new Set(revokedParsed.data.revoked.map((r) => r.urn))
    } catch (error) {
      console.error(
        "Failed to fetch revoked agents list",
        error instanceof Error ? error.message : String(error),
      )
      return { agents: [], error: REVOCATION_LIST_UNAVAILABLE_ERROR }
    }

    const activeAgents = registryParsed.data.agents.filter((agent) => !revokedIds.has(agent.id))

    return { agents: activeAgents }
  } catch (error) {
    console.error("Registry fetch error:", error instanceof Error ? error.message : String(error))
    return { agents: [], error: "Failed to connect to registry" }
  }
}

export function getRegistryCategories(agents: RegistryAgent[]): string[] {
  const categories = new Set<string>()
  for (const agent of agents) {
    if (agent.category) {
      categories.add(agent.category)
    }
  }
  return Array.from(categories).sort()
}
