/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import { Position } from "@xyflow/react"
import { GradientEdge } from "./gradient-edge"
import { AnimatedFlowEdge } from "./animated-flow-edge"
import { edgeTypes } from "./index"

const mockPath = "M 0 0 L 100 100"

vi.mock("@xyflow/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@xyflow/react")>()
  return { ...mod, getBezierPath: vi.fn(() => [mockPath]) }
})

const defaultEdgeProps = {
  id: "e1",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  data: {},
  source: "n1",
  target: "n2",
  sourceHandleId: null,
  targetHandleId: null,
  type: "gradient",
  selected: false,
  zIndex: 0,
  interactionWidth: 20,
  markerStart: undefined,
  markerEnd: undefined,
  pathOptions: {},
  style: undefined,
  className: "",
  isFocusable: false,
  ariaLabel: undefined,
  label: undefined,
  labelStyle: undefined,
  labelShowBg: undefined,
  labelBgStyle: undefined,
  labelBgPadding: undefined,
  labelBgBorderRadius: undefined,
}

describe("GradientEdge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders defs with linearGradient and two path elements", () => {
    const { container } = render(<GradientEdge {...defaultEdgeProps} />)
    const defs = container.querySelector("defs")
    expect(defs).toBeInTheDocument()
    const gradient = defs?.querySelector("linearGradient")
    expect(gradient).toBeInTheDocument()
    expect(gradient?.getAttribute("id")).toBe("gradient-e1")
    const paths = container.querySelectorAll("path")
    expect(paths).toHaveLength(2)
  })

  it("uses default source and target colors when data has no colors", () => {
    const { container } = render(<GradientEdge {...defaultEdgeProps} />)
    const stops = container.querySelectorAll("stop")
    expect(stops).toHaveLength(2)
    expect(stops[0].getAttribute("stop-color") ?? stops[0].getAttribute("stopColor")).toBe(
      "var(--workflow-edge-source)",
    )
    expect(stops[1].getAttribute("stop-color") ?? stops[1].getAttribute("stopColor")).toBe(
      "var(--workflow-edge-target)",
    )
  })

  it("uses data.sourceColor and data.targetColor when provided", () => {
    const { container } = render(
      <GradientEdge
        {...defaultEdgeProps}
        data={{ sourceColor: "#ff0000", targetColor: "#00ff00" }}
      />,
    )
    const stops = container.querySelectorAll("stop")
    expect(stops[0].getAttribute("stop-color") ?? stops[0].getAttribute("stopColor")).toBe(
      "#ff0000",
    )
    expect(stops[1].getAttribute("stop-color") ?? stops[1].getAttribute("stopColor")).toBe(
      "#00ff00",
    )
  })

  it("renders visible path with gradient url referencing gradient id", () => {
    const { container } = render(<GradientEdge {...defaultEdgeProps} />)
    const paths = container.querySelectorAll("path")
    const strokePath = Array.from(paths).find((p) => p.getAttribute("stroke")?.startsWith("url"))
    expect(strokePath).toBeInTheDocument()
    expect(strokePath?.getAttribute("stroke")).toBe("url(#gradient-e1)")
    expect(
      strokePath?.getAttribute("stroke-width") ?? strokePath?.getAttribute("strokeWidth"),
    ).toBe("2")
  })

  it("renders interaction path with transparent stroke and correct width", () => {
    const { container } = render(<GradientEdge {...defaultEdgeProps} />)
    const paths = container.querySelectorAll("path")
    const interactionPath = Array.from(paths).find(
      (p) => p.getAttribute("stroke") === "transparent",
    )
    expect(interactionPath).toBeInTheDocument()
    expect(
      interactionPath?.getAttribute("stroke-width") ?? interactionPath?.getAttribute("strokeWidth"),
    ).toBe("20")
    expect(interactionPath?.classList.contains("react-flow__edge-interaction")).toBe(true)
  })
})

describe("AnimatedFlowEdge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders GradientEdge when data.isRunning is false", () => {
    const { container } = render(
      <AnimatedFlowEdge {...defaultEdgeProps} data={{ isRunning: false }} />,
    )
    const gradient = container.querySelector("defs linearGradient")
    expect(gradient?.getAttribute("id")).toBe("gradient-e1")
    const paths = container.querySelectorAll("path")
    expect(paths).toHaveLength(2)
  })

  it("renders GradientEdge when data is empty", () => {
    const { container } = render(<AnimatedFlowEdge {...defaultEdgeProps} />)
    expect(container.querySelector("defs linearGradient")).toBeInTheDocument()
  })

  it("renders animated path with strokeDasharray when data.isRunning is true", () => {
    const { container } = render(
      <AnimatedFlowEdge {...defaultEdgeProps} data={{ isRunning: true }} />,
    )
    const paths = container.querySelectorAll("path")
    const strokePath = Array.from(paths).find((p) => p.getAttribute("stroke")?.startsWith("url"))
    expect(strokePath).toBeInTheDocument()
    expect(
      strokePath?.getAttribute("stroke-dasharray") ?? strokePath?.getAttribute("strokeDasharray"),
    ).toBe("8 4")
    expect(
      strokePath?.getAttribute("stroke-dashoffset") ?? strokePath?.getAttribute("strokeDashoffset"),
    ).toBe("0")
    expect(strokePath?.classList.contains("animate-flow-dash")).toBe(true)
  })

  it("uses custom sourceColor and targetColor when isRunning and provided in data", () => {
    const { container } = render(
      <AnimatedFlowEdge
        {...defaultEdgeProps}
        data={{
          isRunning: true,
          sourceColor: "#aabbcc",
          targetColor: "#ddeeff",
        }}
      />,
    )
    const stops = container.querySelectorAll("stop")
    expect(stops[0].getAttribute("stop-color") ?? stops[0].getAttribute("stopColor")).toBe(
      "#aabbcc",
    )
    expect(stops[1].getAttribute("stop-color") ?? stops[1].getAttribute("stopColor")).toBe(
      "#ddeeff",
    )
  })
})

describe("edgeTypes", () => {
  it("exports gradient and animatedFlow components", () => {
    expect(edgeTypes.gradient).toBe(GradientEdge)
    expect(edgeTypes.animatedFlow).toBe(AnimatedFlowEdge)
  })
})
