import type React from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { CSP_NONCE_HEADER } from "@/lib/csp-nonce-header"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Agent Builder - AI Agent Platform",
  description: "Build, configure, and run AI agents with tool execution capabilities",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Set by src/proxy.ts on each request. If absent (e.g. misconfigured matcher), inline script may be blocked by CSP.
  const nonce = (await headers()).get(CSP_NONCE_HEADER) ?? undefined

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {nonce ? (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `
              try {
                const color = localStorage.getItem("app-accent-color")
                if (color) {
                  document.documentElement.style.setProperty("--primary", color)
                }
              } catch (e) {
                console.warn("Accent color restoration failed:", e)
              }
            `,
            }}
          />
        ) : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" storageKey="agent-builder-theme">
          <AuthProvider>
            <div className="bg-background text-foreground flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto pt-14 lg:pt-0">{children}</main>
            </div>
            <Toaster position="top-right" richColors />
            <Analytics />
            <SpeedInsights />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
