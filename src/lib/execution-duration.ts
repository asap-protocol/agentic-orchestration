/**
 * Coerce unknown date-like values to a valid Date, or null if invalid.
 * Useful after JSON deserialization where Date fields arrive as ISO strings.
 *
 * @example
 * toValidDate("2026-01-01T00:00:00.000Z")?.getTime()
 */
export function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

/**
 * Duration in milliseconds between two date-like values, or null if either is invalid.
 *
 * @example
 * durationMs("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:05.000Z") // 5000
 */
export function durationMs(startedAt: unknown, completedAt: unknown): number | null {
  const start = toValidDate(startedAt)
  const end = toValidDate(completedAt)
  if (!start || !end) return null
  return end.getTime() - start.getTime()
}
