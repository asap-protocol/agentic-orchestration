import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { mcpClient } from "@/lib/mcp-client"

export async function GET() {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const servers = mcpClient.getServers(userIdOrError)
  return NextResponse.json(servers)
}

export async function POST(request: Request) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const body = await request.json()
  const { ownerUserId: _ignoredOwner, name, url, protocol, environment } = body

  try {
    const server = await mcpClient.connectServer({
      name,
      url,
      protocol: protocol || "http",
      environment,
      ownerUserId: userIdOrError,
    })

    return NextResponse.json(server, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
