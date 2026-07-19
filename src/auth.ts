import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import GitHub from "next-auth/providers/github"
import { resolveRedirectUrl } from "@/lib/auth-redirect"
import { getStubAuthSession, shouldUseStubAuthSession } from "@/lib/auth-mock-session"

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

// Wrapped auth — see `shouldUseStubAuthSession` / `playwright.config` (PLAYWRIGHT_E2E=1 on `next start`).
export const auth = (async () => {
  if (shouldUseStubAuthSession()) {
    return getStubAuthSession()
  }
  return authInternal()
}) as typeof authInternal
