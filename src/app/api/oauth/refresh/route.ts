import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { oauthManager } from "@/lib/oauth-manager"
import { connectorStore } from "@/lib/connector-store"

export async function POST(request: Request) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const body = await request.json()
  const { connectionId } = body

  if (typeof connectionId !== "string" || connectionId.length === 0) {
    return NextResponse.json({ error: "connectionId must be a non-empty string" }, { status: 400 })
  }

  try {
    const connection = connectorStore.getConnectionById(connectionId, userIdOrError)

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    if (!connection.config.credentials?.refreshToken) {
      return NextResponse.json({ error: "No refresh token available" }, { status: 400 })
    }

    const tokens = await oauthManager.refreshAccessToken(
      connection.connectorId,
      connection.config.credentials.refreshToken,
    )

    connectorStore.updateConnection(connectionId, userIdOrError, {
      config: {
        ...connection.config,
        credentials: {
          ...connection.config.credentials,
          accessToken: tokens.accessToken,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
