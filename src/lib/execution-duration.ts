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
  if (typeof value === "string") {
    if (!hasValidCalendarDate(value)) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

/** Reject JS Date rollover of impossible calendars like 2026-02-30. */
function hasValidCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return true
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() + 1 === month && utc.getUTCDate() === day
  )
}

/**
 * Duration in milliseconds between two date-like values, or null if either is invalid
 * or the span is negative.
 *
 * @example
 * durationMs("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:05.000Z") // 5000
 */
export function durationMs(startedAt: unknown, completedAt: unknown): number | null {
  const start = toValidDate(startedAt)
  const end = toValidDate(completedAt)
  if (!start || !end) return null
  const ms = end.getTime() - start.getTime()
  if (ms < 0) return null
  return ms
}
