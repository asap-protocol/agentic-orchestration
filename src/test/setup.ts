import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof matchMedia
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class MockIntersectionObserver {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe = () => this.callback([{ isIntersecting: true }])
    unobserve = () => {}
    disconnect = () => {}
  } as unknown as typeof IntersectionObserver
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class MockResizeObserver {
    observe = () => {}
    unobserve = () => {}
    disconnect = () => {}
  } as unknown as typeof ResizeObserver
}

// Radix UI (Tabs, etc.) requires PointerEvent APIs that jsdom lacks
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn()
  }
}
