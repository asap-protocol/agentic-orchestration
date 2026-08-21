import { afterEach, describe, expect, it, vi } from "vitest"
import { assertAllowedSupabaseConnectionUrl } from "@/lib/supabase-connection-url"

describe("assertAllowedSupabaseConnectionUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("allows https supabase.co and supabase.net project hosts", () => {
    expect(assertAllowedSupabaseConnectionUrl("https://abcdxyz.supabase.co")).toBe(
      "https://abcdxyz.supabase.co",
    )
    expect(assertAllowedSupabaseConnectionUrl("https://abcdxyz.supabase.net/rest/v1")).toBe(
      "https://abcdxyz.supabase.net",
    )
  })

  it("rejects loopback, link-local, private, and metadata URLs", () => {
    const blocked = [
      "http://127.0.0.1/",
      "http://127.0.0.1:54321/",
      "http://localhost:3000/",
      "http://169.254.169.254/",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.1.10/",
      "http://10.0.0.1/",
      "https://[::1]/",
      "http://127.0.0.1.nip.io/",
      "https://evil.example/",
      "http://abcdxyz.supabase.co/",
      "file:///etc/passwd",
      "https://user:pass@abcdxyz.supabase.co/",
      "https://abcdxyz.supabase.co.evil.example/",
    ]
    for (const url of blocked) {
      expect(() => assertAllowedSupabaseConnectionUrl(url)).toThrow(/not allowed/)
    }
  })

  it("allows an exact origin match of NEXT_PUBLIC_SUPABASE_URL for self-hosted setups", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    expect(assertAllowedSupabaseConnectionUrl("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321",
    )
    expect(() => assertAllowedSupabaseConnectionUrl("http://127.0.0.1:8080")).toThrow(/not allowed/)
    expect(() => assertAllowedSupabaseConnectionUrl("http://169.254.169.254/")).toThrow(
      /not allowed/,
    )
  })

  it("rejects unparseable values", () => {
    expect(() => assertAllowedSupabaseConnectionUrl("not-a-url")).toThrow(/not allowed/)
  })
})
