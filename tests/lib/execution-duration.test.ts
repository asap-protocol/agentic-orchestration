import { describe, it, expect } from "vitest"
import { toValidDate, durationMs } from "@/lib/execution-duration"

describe("toValidDate", () => {
  it("returns a Date for ISO strings", () => {
    const result = toValidDate("2026-01-01T00:00:00.000Z")
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })

  it("returns the same Date when already valid", () => {
    const input = new Date("2026-06-15T12:00:00.000Z")
    expect(toValidDate(input)).toBe(input)
  })

  it("returns null for invalid strings", () => {
    expect(toValidDate("not-a-date")).toBeNull()
  })

  it("returns null for impossible calendar dates", () => {
    expect(toValidDate("2026-02-30T00:00:00.000Z")).toBeNull()
  })

  it("returns null for Invalid Date instances", () => {
    expect(toValidDate(new Date("invalid"))).toBeNull()
  })

  it("returns null for unsupported types", () => {
    expect(toValidDate(null)).toBeNull()
    expect(toValidDate(undefined)).toBeNull()
    expect(toValidDate({})).toBeNull()
  })
})

describe("durationMs", () => {
  it("computes duration from ISO string dates", () => {
    expect(durationMs("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:05.250Z")).toBe(5250)
  })

  it("computes duration from Date instances", () => {
    const start = new Date("2026-01-01T00:00:00.000Z")
    const end = new Date("2026-01-01T00:00:03.000Z")
    expect(durationMs(start, end)).toBe(3000)
  })

  it("returns null when either date is invalid", () => {
    expect(durationMs("bad", "2026-01-01T00:00:00.000Z")).toBeNull()
    expect(durationMs("2026-01-01T00:00:00.000Z", "bad")).toBeNull()
    expect(durationMs(undefined, "2026-01-01T00:00:00.000Z")).toBeNull()
  })

  it("returns null for negative spans", () => {
    expect(durationMs("2026-01-01T00:00:05.000Z", "2026-01-01T00:00:00.000Z")).toBeNull()
  })

  it("returns null for impossible calendar dates that JS would roll over", () => {
    expect(durationMs("2026-02-30T00:00:00.000Z", "2026-03-01T00:00:00.000Z")).toBeNull()
  })
})
