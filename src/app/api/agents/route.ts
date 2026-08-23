import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { store } from "@/lib/store"
import type { Agent } from "@/lib/types"
import { NextResponse } from "next/server"

type AgentCreateBody = Omit<Agent, "id" | "createdAt" | "updatedAt" | "ownerUserId">

export async function GET() {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const agents = store.getAgents(userIdOrError)
  return NextResponse.json(agents)
}

export async function POST(req: Request) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const body = (await req.json()) as Partial<AgentCreateBody> & {
    ownerUserId?: string
    id?: string
    createdAt?: Date
    updatedAt?: Date
  }
  const { ownerUserId: _ignoredOwner, id: _ignoredId, createdAt: _c, updatedAt: _u, ...rest } = body
  const agent = store.createAgent({
    ...(rest as AgentCreateBody),
    ownerUserId: userIdOrError,
  })
  return NextResponse.json(agent)
}
