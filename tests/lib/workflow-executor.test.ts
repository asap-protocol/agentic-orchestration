import { describe, it, expect } from "vitest"
import { WorkflowExecutor } from "@/lib/workflow-executor"
import type { Workflow, WorkflowNode, Connection } from "@/lib/workflow-types"

function node(
  id: string,
  type: WorkflowNode["type"],
  data: Partial<WorkflowNode["data"]> = {},
): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, ...data },
  }
}

function connection(
  id: string,
  sourceId: string,
  targetId: string,
  label?: string,
): Connection {
  return { id, sourceId, targetId, label }
}

function workflow(
  nodes: WorkflowNode[],
  connections: Connection[],
): Workflow {
  return {
    id: "wf-test",
    name: "Test",
    description: "",
    nodes,
    connections,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }
}

describe("WorkflowExecutor", () => {
  it("fails when the workflow has no start node", async () => {
    const executor = new WorkflowExecutor(
      workflow([node("end", "end")], []),
      "hello",
    )

    const result = await executor.execute()

    expect(result.status).toBe("failed")
    expect(result.logs.some((l) => l.message === "No start node found in workflow")).toBe(
      true,
    )
  })

  it("walks start → condition(true) → true branch → end", async () => {
    const updates: string[] = []
    const executor = new WorkflowExecutor(
      workflow(
        [
          node("start", "start"),
          node("cond", "condition", { condition: "true" }),
          node("mcp-true", "mcp", { mcpServer: "tools" }),
          node("mcp-false", "mcp", { mcpServer: "other" }),
          node("end", "end"),
        ],
        [
          connection("c1", "start", "cond"),
          connection("c2", "cond", "mcp-true", "true"),
          connection("c3", "cond", "mcp-false", "false"),
          connection("c4", "mcp-true", "end"),
          connection("c5", "mcp-false", "end"),
        ],
      ),
      "input",
      (execution) => {
        if (execution.currentNodeId) updates.push(execution.currentNodeId)
      },
    )

    const result = await executor.execute()

    expect(result.status).toBe("completed")
    expect(result.logs.some((l) => l.message === "Condition evaluated to: true")).toBe(
      true,
    )
    expect(result.logs.some((l) => l.message.includes("Calling MCP server: tools"))).toBe(
      true,
    )
    expect(result.logs.some((l) => l.message.includes("Calling MCP server: other"))).toBe(
      false,
    )
    expect(updates).toContain("cond")
    expect(updates).toContain("mcp-true")
  })

  it("walks start → condition(false) → false branch → end", async () => {
    const executor = new WorkflowExecutor(
      workflow(
        [
          node("start", "start"),
          node("cond", "condition", { condition: "FALSE" }),
          node("mcp-true", "mcp", { mcpServer: "tools" }),
          node("mcp-false", "mcp", { mcpServer: "other" }),
          node("end", "end"),
        ],
        [
          connection("c1", "start", "cond"),
          connection("c2", "cond", "mcp-true", "true"),
          connection("c3", "cond", "mcp-false", "false"),
          connection("c4", "mcp-true", "end"),
          connection("c5", "mcp-false", "end"),
        ],
      ),
      "input",
    )

    const result = await executor.execute()

    expect(result.status).toBe("completed")
    expect(result.logs.some((l) => l.message === "Condition evaluated to: false")).toBe(
      true,
    )
    expect(result.logs.some((l) => l.message.includes("Calling MCP server: other"))).toBe(
      true,
    )
    expect(result.logs.some((l) => l.message.includes("Calling MCP server: tools"))).toBe(
      false,
    )
  })

  it("completes a linear start → mcp → end graph", async () => {
    const executor = new WorkflowExecutor(
      workflow(
        [node("start", "start"), node("mcp1", "mcp", { mcpServer: "s" }), node("end", "end")],
        [connection("c1", "start", "mcp1"), connection("c2", "mcp1", "end")],
      ),
      "run",
    )

    const result = await executor.execute()

    expect(result.status).toBe("completed")
    expect(result.completedAt).toBeInstanceOf(Date)
    expect(result.context.input).toBe("run")
  })
})
