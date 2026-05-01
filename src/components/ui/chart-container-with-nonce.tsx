import type { ComponentProps } from "react"
import { headers } from "next/headers"

import { CSP_NONCE_HEADER } from "@/lib/csp-nonce-header"

import { ChartContainer } from "./chart"

export type ChartContainerWithNonceProps = Omit<
  ComponentProps<typeof ChartContainer>,
  "documentNonce"
>

/** Server wrapper: forwards the per-request CSP nonce from src/proxy.ts to the client ChartContainer. */
export async function ChartContainerWithNonce(props: ChartContainerWithNonceProps) {
  const nonce = (await headers()).get(CSP_NONCE_HEADER) ?? undefined
  return <ChartContainer {...props} documentNonce={nonce} />
}
