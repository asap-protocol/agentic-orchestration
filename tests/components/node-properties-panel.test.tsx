// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NodePropertiesPanel } from "@/components/builder/node-properties-panel"
import type { WorkflowNode } from "@/lib/workflow-types"

const agentNode: WorkflowNode = {
  id: "n1",
  type: "agent",
  position: { x: 0, y: 0 },
  data: { label: "Agent", systemPrompt: "old prompt" },
}

describe("NodePropertiesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch
  })

  it("calls onBeforeSave before persisting property changes", async () => {
    const user = userEvent.setup()
    const onBeforeSave = vi.fn()
    const onUpdate = vi.fn()

    render(
      <NodePropertiesPanel
        isOpen={true}
        onToggle={vi.fn()}
        node={agentNode}
        workflowId="wf-1"
        onBeforeSave={onBeforeSave}
        onUpdate={onUpdate}
      />,
    )

    const promptField = screen.getByLabelText("System Prompt")
    await user.clear(promptField)
    await user.type(promptField, "new prompt")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => {
      expect(onBeforeSave).toHaveBeenCalledOnce()
    })
    expect(onBeforeSave.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[0],
    )
    expect(onUpdate).toHaveBeenCalledOnce()
  })
})
