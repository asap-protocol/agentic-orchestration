import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Request-scoped Supabase client. ALWAYS uses the anon key so Row Level Security
// is enforced for the authenticated user. Never substitute the service-role key
// here: that would bypass RLS for every request. Use a dedicated admin client in
// trusted server-only paths if elevated access is genuinely required.
export async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore headers-sent errors
        }
      },
    },
  })

  return supabase
}
