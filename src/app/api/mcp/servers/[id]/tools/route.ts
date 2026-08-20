import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { mcpClient } from "@/lib/mcp-client"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { id } = await params
  const server = mcpClient.getServer(id, userIdOrError)
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 })
  }
  const tools = mcpClient.getToolsByServer(id, userIdOrError)
  return NextResponse.json(tools)
}
