import { streamText, tool, convertToModelMessages, type UIMessage } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { requireSessionUserId } from "@/lib/api/require-session-user-id"
import { store } from "@/lib/store"

export const maxDuration = 60

function safeEvaluateMath(expression: string): number {
  const sanitized = expression.replace(/\s/g, "")
  if (!/^[\d+\-*/().%^]+$/.test(sanitized)) {
    throw new Error("Invalid characters in expression")
  }
  if (sanitized.length > 200) {
    throw new Error("Expression too long")
  }
  const tokens = sanitized.match(/(\d+\.?\d*|[+\-*/().%^])/g)
  if (!tokens) throw new Error("Invalid expression")

  let pos = 0
  function parseExpression(): number {
    let result = parseTerm()
    while (pos < tokens!.length && (tokens![pos] === "+" || tokens![pos] === "-")) {
      const op = tokens![pos++]
      const term = parseTerm()
      result = op === "+" ? result + term : result - term
    }
    return result
  }
  function parseTerm(): number {
    let result = parseFactor()
    while (
      pos < tokens!.length &&
      (tokens![pos] === "*" || tokens![pos] === "/" || tokens![pos] === "%")
    ) {
      const op = tokens![pos++]
      const factor = parseFactor()
      if ((op === "/" || op === "%") && factor === 0) throw new Error("Division by zero")
      result = op === "*" ? result * factor : op === "/" ? result / factor : result % factor
    }
    return result
  }
  function parseFactor(): number {
    let result = parseUnary()
    if (pos < tokens!.length && tokens![pos] === "^") {
      pos++
      const exponent = parseFactor()
      result = Math.pow(result, exponent)
    }
    return result
  }
  function parseUnary(): number {
    if (tokens![pos] === "-") {
      pos++
      return -parseUnary()
    }
    if (tokens![pos] === "+") {
      pos++
      return parseUnary()
    }
    return parsePrimary()
  }
  function parsePrimary(): number {
    if (tokens![pos] === "(") {
      pos++
      const result = parseExpression()
      if (tokens![pos] !== ")") throw new Error("Mismatched parentheses")
      pos++
      return result
    }
    const num = parseFloat(tokens![pos++])
    if (isNaN(num)) throw new Error("Invalid number")
    return num
  }
  const result = parseExpression()
  if (pos !== tokens.length) throw new Error("Unexpected tokens")
  return result
}

const availableTools = {
  "web-search": tool({
    description: "Search the web for current information",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
    }),
    async execute({ query }) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return {
        results: [
          {
            title: `Result for "${query}"`,
            snippet: "This is a simulated search result.",
            url: "https://example.com",
          },
          {
            title: `More about ${query}`,
            snippet: "Additional information found.",
            url: "https://example.org",
          },
        ],
      }
    },
  }),
  "get-weather": tool({
    description: "Get current weather for a location",
    inputSchema: z.object({
      location: z.string().describe("The city name"),
    }),
    async execute({ location }) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"]
      return {
        location,
        temperature: Math.floor(Math.random() * 30) + 50,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        humidity: Math.floor(Math.random() * 50) + 30,
      }
    },
  }),
  calculate: tool({
    description: "Perform mathematical calculations",
    inputSchema: z.object({
      expression: z.string().describe("The math expression to evaluate"),
    }),
    async execute({ expression }) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      try {
        const result = safeEvaluateMath(expression)
        return { expression, result }
      } catch {
        return { expression, error: "Could not evaluate expression" }
      }
    },
  }),
  "code-interpreter": tool({
    description: "Execute Python code and return results",
    inputSchema: z.object({
      code: z.string().describe("The Python code to execute"),
    }),
    async execute({ code }) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      return {
        code,
        output: `Executed code successfully.\nSimulated output for: ${code.slice(0, 50)}...`,
        executionTime: "0.05s",
      }
    },
  }),
  "file-search": tool({
    description: "Search through uploaded files",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
    }),
    async execute({ query }) {
      await new Promise((resolve) => setTimeout(resolve, 600))
      return {
        query,
        matches: [
          { filename: "document.pdf", excerpt: `Found "${query}" in paragraph 3...`, page: 3 },
          { filename: "notes.txt", excerpt: `Reference to ${query} found...`, line: 42 },
        ],
      }
    },
  }),
}

export async function POST(req: Request) {
  const session = await auth()
  const userIdOrError = requireSessionUserId(session)
  if (userIdOrError instanceof NextResponse) return userIdOrError

  const { messages, agentId }: { messages: UIMessage[]; agentId: string } = await req.json()

  const agent = store.getAgent(agentId, userIdOrError)
  if (!agent) {
    return new Response("Agent not found", { status: 404 })
  }

  const agentTools: Record<string, (typeof availableTools)[keyof typeof availableTools]> = {}
  agent.tools.forEach((toolId) => {
    const toolKey = toolId as keyof typeof availableTools
    if (availableTools[toolKey]) {
      agentTools[toolId] = availableTools[toolKey]
    }
  })

  let modelString = agent.model
  if (agent.model.startsWith("gpt")) {
    modelString = `openai/${agent.model}`
  } else if (agent.model.startsWith("claude")) {
    modelString = `anthropic/${agent.model}`
  }

  const result = streamText({
    model: modelString,
    system: agent.systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: agentTools,
  })

  return result.toUIMessageStreamResponse()
}
