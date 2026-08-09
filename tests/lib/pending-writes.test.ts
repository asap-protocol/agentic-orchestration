import { describe, expect, it } from "vitest"
import { createPendingWriteTracker } from "@/lib/builder/pending-writes"

describe("createPendingWriteTracker", () => {
  it("awaits in-flight writes before proceeding", async () => {
    const { track, awaitAll } = createPendingWriteTracker()
    let done = false
    track(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          done = true
          resolve()
        }, 30)
      }),
    )

    const flush = awaitAll()
    expect(done).toBe(false)
    await flush
    expect(done).toBe(true)
  })

  it("resolves immediately when no writes are pending", async () => {
    const { awaitAll } = createPendingWriteTracker()
    await expect(awaitAll()).resolves.toBeUndefined()
  })
})
