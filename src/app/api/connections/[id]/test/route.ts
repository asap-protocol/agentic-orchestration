import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { connectorStore } from "@/lib/connector-store"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  const result = await connectorStore.testConnection(id, userIdOrError)
  if (!result.success && result.message === "Connection not found") {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 })
  }
  return NextResponse.json(result)
}
