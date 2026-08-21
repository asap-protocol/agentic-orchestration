import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  assertAllowedSupabaseConnectionUrl,
  DisallowedSupabaseConnectionUrlError,
} from "@/lib/supabase-connection-url"

const TestConnectionBodySchema = z
  .object({
    url: z.string().optional(),
    key: z.string().optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const parsedBody = TestConnectionBodySchema.safeParse(await request.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 },
      )
    }
    const { url, key } = parsedBody.data

    const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing Supabase URL or API key",
        },
        { status: 400 },
      )
    }

    const allowedUrl = assertAllowedSupabaseConnectionUrl(supabaseUrl)

    const supabase = createClient(allowedUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const requiredTables = [
      "profiles",
      "workspaces",
      "workspace_members",
      "agents",
      "workflows",
      "workflow_nodes",
      "workflow_connections",
      "workflow_executions",
      "execution_logs",
      "runs",
      "connectors",
      "connections",
      "mcp_servers",
    ]

    const tablesFound: string[] = []
    const tablesMissing: string[] = []

    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select("count").limit(0)
      if (error) {
        tablesMissing.push(table)
      } else {
        tablesFound.push(table)
      }
    }

    const connectionValid = tablesFound.length > 0

    let authEnabled = false
    try {
      const { data: _data } = await supabase.auth.getSession()
      authEnabled = true
    } catch (_e) {
      authEnabled = false
    }

    const success = tablesMissing.length === 0 && connectionValid

    return NextResponse.json({
      success,
      message: success
        ? "All tables found! Database is fully configured."
        : tablesMissing.length === requiredTables.length
          ? "No tables found. Please run the SQL setup script."
          : `${tablesMissing.length} table(s) missing. Please run the complete SQL setup script.`,
      details: {
        tablesFound,
        tablesMissing,
        connectionValid,
        authEnabled,
      },
    })
  } catch (error) {
    if (error instanceof DisallowedSupabaseConnectionUrlError) {
      return NextResponse.json(
        {
          success: false,
          message: "Supabase URL is not allowed.",
        },
        { status: 400 },
      )
    }
    return NextResponse.json(
      {
        success: false,
        message: "Connection failed. Check the Supabase URL and API key.",
      },
      { status: 500 },
    )
  }
}
