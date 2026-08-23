import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { store } from "@/lib/store"
import type { Agent } from "@/lib/types"
import { NextResponse } from "next/server"

type AgentUpdateBody = Partial<Omit<Agent, "id" | "ownerUserId" | "createdAt">>

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  const agent = store.getAgent(id, userIdOrError)
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  return NextResponse.json(agent)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  const body = (await req.json()) as AgentUpdateBody & {
    ownerUserId?: string
    id?: string
    createdAt?: Date
  }
  const { ownerUserId: _ignoredOwner, id: _ignoredId, createdAt: _c, ...updates } = body
  const agent = store.updateAgent(id, userIdOrError, updates)
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  return NextResponse.json(agent)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  const deleted = store.deleteAgent(id, userIdOrError)
  if (!deleted) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
