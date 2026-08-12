import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { connectorStore } from "@/lib/connector-store"
import type { Connection } from "@/lib/connector-types"

type ConnectionUpdate = Partial<Omit<Connection, "id" | "ownerUserId" | "createdAt">>

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  // Path param is connectorId (legacy route shape).
  const connections = connectorStore.getConnectionsByConnector(id, userIdOrError)
  return NextResponse.json(connections)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  const body = (await request.json()) as ConnectionUpdate & {
    ownerUserId?: string
    id?: string
  }
  const { ownerUserId: _ignoredOwner, id: _ignoredId, ...updates } = body
  const connection = connectorStore.updateConnection(id, userIdOrError, updates)

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 })
  }

  return NextResponse.json(connection)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  const success = connectorStore.deleteConnection(id, userIdOrError)

  if (!success) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
