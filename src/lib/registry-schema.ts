import { z } from "zod"

export const registryAgentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    version: z.string().optional(),
    asap_version: z.string().optional(),
    description: z.string(),
    skills: z.array(z.string()).optional(),
    capabilities: z
      .object({
        skills: z
          .array(
            z.object({
              id: z.string(),
              description: z.string(),
            }),
          )
          .optional(),
      })
      .optional(),
    endpoints: z
      .object({
        asap: z.string().optional(),
        ws: z.string().optional(),
        http: z.string().optional(),
        manifest: z.string().optional(),
      })
      .optional(),
    auth: z
      .object({
        schemes: z.array(z.string()).optional(),
        oauth2: z
          .object({
            authorization_url: z.string().optional(),
            token_url: z.string().optional(),
            scopes: z.array(z.string()).optional(),
          })
          .optional(),
      })
      .optional(),
    sla: z
      .object({
        max_response_time_seconds: z.number().optional(),
      })
      .optional(),
    repository_url: z.string().url().nullable().optional(),
    documentation_url: z.string().url().nullable().optional(),
    built_with: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough()

export const registryResponseSchema = z.object({
  agents: z.array(registryAgentSchema),
})

/** Canonical ASAP shape uses `urn`; legacy payloads may use `id` only. */
export const revokedAgentSchema = z
  .object({
    urn: z.string().optional(),
    id: z.string().optional(),
    revoked_at: z.string(),
    reason: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.urn && !data.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Revoked entry must include urn or id",
        path: ["urn"],
      })
    }
  })
  .transform((data) => {
    const urn = data.urn ?? data.id
    return {
      urn: urn as string,
      revoked_at: data.revoked_at,
      reason: data.reason,
    }
  })

export const revokedResponseSchema = z.object({
  revoked: z.array(revokedAgentSchema),
  version: z.string().optional(),
})
