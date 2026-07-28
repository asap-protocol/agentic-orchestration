"use client"

import dynamic from "next/dynamic"

/** Mobile shell header offset (`main` uses `pt-14`); desktop has no top padding. */
const BUILDER_SHELL_HEIGHT = "h-[calc(100dvh-3.5rem)] w-full overflow-hidden lg:h-dvh"

const BuilderCanvas = dynamic(
  () => import("./builder-canvas").then((m) => ({ default: m.BuilderCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="bg-background flex h-full min-h-0 items-center justify-center">
        <div className="text-muted-foreground">Loading workflow builder...</div>
      </div>
    ),
  },
)

export function BuilderClient() {
  return (
    <div className={BUILDER_SHELL_HEIGHT}>
      <BuilderCanvas />
    </div>
  )
}
