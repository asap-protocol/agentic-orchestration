import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  OAUTH_PKCE_COOKIE_NAME,
  getOAuthPkceCookieSerializationOptions,
  oauthManager,
} from "@/lib/oauth-manager"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { connectorId } = body

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/oauth/callback`
    const { authUrl, pkceCookieValue } = await oauthManager.generateAuthUrl(
      connectorId,
      redirectUri,
    )

    const res = NextResponse.json({ authUrl })
    res.cookies.set(
      OAUTH_PKCE_COOKIE_NAME,
      pkceCookieValue,
      getOAuthPkceCookieSerializationOptions(),
    )
    return res
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
