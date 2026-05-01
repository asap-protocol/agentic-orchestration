import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import GitHub from "next-auth/providers/github"
import { resolveRedirectUrl } from "@/lib/auth-redirect"

const config: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID ?? "",
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
      authorization: { params: { scope: "read:user" } },
    }),
  ],
  trustHost: true,
  callbacks: {
    redirect({ url, baseUrl }) {
      return resolveRedirectUrl(url, baseUrl, process.env.NEXT_PUBLIC_ASAP_PROTOCOL_URL)
    },
    jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        if (profile && typeof profile === "object" && "login" in profile) {
          token.username = profile.login as string
        }
      }
      return token
    },
    async session({ session, token }) {
      if (typeof token.id === "string" && session.user) {
        session.user.id = token.id
      }
      if (typeof token.username === "string" && session.user) {
        ;(session.user as { username?: string }).username = token.username
      }
      if (typeof token.supabaseAccessToken === "string") {
        ;(session as any).supabaseAccessToken = token.supabaseAccessToken
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}

export const { handlers, auth: authInternal, signIn, signOut } = NextAuth(config)

// Export a wrapped auth that provides a mock session in development and E2E.
// The double guard (NODE_ENV !== "production" AND an explicit dev/E2E flag)
// ensures this bypass can never accidentally activate in production builds.
export const auth = (async () => {
  const isProduction = process.env.NODE_ENV === "production"
  const isDevOrE2E = process.env.NODE_ENV === "development" || process.env.PLAYWRIGHT_E2E === "1"
  if (!isProduction && isDevOrE2E) {
    return {
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Dev User",
        email: "dev@example.com",
        username: "devuser",
      },
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
    }
  }
  return authInternal()
}) as typeof authInternal
