import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  OAUTH_PKCE_COOKIE_NAME,
  getOAuthPkceCookieClearOptions,
  oauthManager,
} from "@/lib/oauth-manager"
import { connectorStore } from "@/lib/connector-store"

function withClearedPkceCookie(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_PKCE_COOKIE_NAME, "", getOAuthPkceCookieClearOptions())
  return response
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return withClearedPkceCookie(
      NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(error)}`, request.url)),
    )
  }

  if (!code || !state) {
    return withClearedPkceCookie(
      NextResponse.redirect(new URL("/connectors?error=missing_parameters", request.url)),
    )
  }

  const cookieStore = await cookies()
  const pkceCookie = cookieStore.get(OAUTH_PKCE_COOKIE_NAME)?.value

  try {
    const oauthState = await oauthManager.verifyPkceCookie(pkceCookie, state)
    if (!oauthState) {
      throw new Error("Invalid OAuth state")
    }

    const tokens = await oauthManager.exchangeCodeForToken(code, oauthState)

    const _connection = connectorStore.addConnection({
      connectorId: oauthState.connectorId,
      name: `${oauthState.connectorId} Connection`,
      status: "connected",
      config: {
        authType: "oauth2",
        credentials: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    })

    return withClearedPkceCookie(
      NextResponse.redirect(new URL("/connectors?success=connected", request.url)),
    )
  } catch (err) {
    return withClearedPkceCookie(
      NextResponse.redirect(
        new URL(`/connectors?error=${encodeURIComponent((err as Error).message)}`, request.url),
      ),
    )
  }
}
