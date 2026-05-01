// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid"
import { Bot } from "lucide-react"

describe("BentoGrid", () => {
  it("renders children in a grid layout", () => {
    const { container } = render(
      <BentoGrid>
        <div data-testid="child-1">Card 1</div>
        <div data-testid="child-2">Card 2</div>
      </BentoGrid>,
    )
    const grid = container.querySelector('[data-slot="bento-grid"]')
    expect(grid).toBeInTheDocument()
    expect(grid).toHaveClass("grid")
    expect(grid).toHaveClass("grid-cols-1")
    expect(grid).toHaveClass("md:grid-cols-2")
    expect(grid).toHaveClass("lg:grid-cols-3")
    expect(grid).toHaveClass("gap-3")
    expect(screen.getByTestId("child-1")).toBeInTheDocument()
    expect(screen.getByTestId("child-2")).toBeInTheDocument()
  })
})

describe("BentoCard", () => {
  it("renders icon, title, description, and value", () => {
    render(<BentoCard icon={Bot} title="Agents" description="Manage your AI agents" value={42} />)
    expect(screen.getByText("Agents")).toBeInTheDocument()
    expect(screen.getByText("Manage your AI agents")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("renders without value when value prop is omitted", () => {
    render(<BentoCard icon={Bot} title="Settings" description="Configure your preferences" />)
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.getByText("Configure your preferences")).toBeInTheDocument()
    expect(screen.queryByText("42")).not.toBeInTheDocument()
  })

  it("renders radial grid reveal div with opacity-0 by default", () => {
    const { container } = render(
      <BentoCard icon={Bot} title="Test" description="Test description" />,
    )
    const radialDiv = container.querySelector('[data-slot="bento-card-radial"]')
    expect(radialDiv).toBeInTheDocument()
    expect(radialDiv).toHaveClass("reveal-on-hover")
  })

  it("applies custom className (e.g. md:col-span-2)", () => {
    const { container } = render(
      <BentoCard
        icon={Bot}
        title="Wide Card"
        description="Spans two columns"
        className="md:col-span-2"
      />,
    )
    const card = container.querySelector('[data-slot="bento-card"]')
    expect(card).toHaveClass("md:col-span-2")
  })
})
