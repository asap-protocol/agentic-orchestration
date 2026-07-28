import { z } from "zod"

/**
 * Strict positive integer version path/query param (rejects "1junk", "1.5").
 *
 * @example
 * versionParamSchema.parse("3") // 3
 */
export const versionParamSchema = z
  .string()
  .regex(/^\d+$/, "version must be a positive integer string")
  .transform(Number)
  .pipe(z.number().int().positive())

export function parseVersionParam(raw: string): { ok: true; value: number } | { ok: false } {
  const parsed = versionParamSchema.safeParse(raw)
  if (!parsed.success) return { ok: false }
  return { ok: true, value: parsed.data }
}
