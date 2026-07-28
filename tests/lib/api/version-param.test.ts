import { describe, it, expect } from "vitest"
import { parseVersionParam, versionParamSchema } from "@/lib/api/version-param"

describe("versionParamSchema", () => {
  it("accepts positive integer strings", () => {
    expect(versionParamSchema.parse("1")).toBe(1)
    expect(versionParamSchema.parse("42")).toBe(42)
  })

  it("rejects floats, junk suffixes, and zero", () => {
    expect(versionParamSchema.safeParse("1.5").success).toBe(false)
    expect(versionParamSchema.safeParse("1junk").success).toBe(false)
    expect(versionParamSchema.safeParse("0").success).toBe(false)
    expect(versionParamSchema.safeParse("-2").success).toBe(false)
  })
})

describe("parseVersionParam", () => {
  it("returns ok with value for valid params", () => {
    expect(parseVersionParam("3")).toEqual({ ok: true, value: 3 })
  })

  it("returns not ok for invalid params", () => {
    expect(parseVersionParam("1junk")).toEqual({ ok: false })
  })
})
