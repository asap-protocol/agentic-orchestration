import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { mcpClient } from "@/lib/mcp-client"

export async function POST(request: Request) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const body = await request.json()

  try {
    const result = await mcpClient.callTool(body.toolName, body.args, userIdOrError)
    return NextResponse.json({ result })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
