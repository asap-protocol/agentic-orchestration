/** Tracks in-flight graph mutation fetches so version saves snapshot committed state. */
export function createPendingWriteTracker() {
  const pending = new Set<Promise<unknown>>()

  function track<T>(promise: Promise<T>): Promise<T> {
    pending.add(promise)
    return promise.finally(() => {
      pending.delete(promise)
    })
  }

  async function awaitAll(): Promise<void> {
    const snapshot = [...pending]
    if (snapshot.length === 0) {
      return
    }
    await Promise.allSettled(snapshot)
  }

  return { track, awaitAll }
}
