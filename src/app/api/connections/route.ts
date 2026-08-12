import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { connectorStore } from "@/lib/connector-store"
import type { Connection } from "@/lib/connector-types"

type ConnectionCreateBody = Omit<Connection, "id" | "createdAt" | "ownerUserId">

export async function GET() {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const connections = connectorStore.getConnections(userIdOrError)
  return NextResponse.json(connections)
}

export async function POST(request: Request) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const body = (await request.json()) as Partial<ConnectionCreateBody> & {
    ownerUserId?: string
  }
  // Ignore any client-supplied ownerUserId — ownership always comes from the session.
  const { ownerUserId: _ignored, ...rest } = body
  const connection = connectorStore.addConnection({
    ...(rest as ConnectionCreateBody),
    ownerUserId: userIdOrError,
  })
  return NextResponse.json(connection, { status: 201 })
}
