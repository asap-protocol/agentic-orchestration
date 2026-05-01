import { forwardRef } from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface BentoGridProps {
  children: React.ReactNode
  className?: string
}

function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      data-slot="bento-grid"
      className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3", className)}
    >
      {children}
    </div>
  )
}

interface BentoCardProps {
  title: string
  description: string
  icon: LucideIcon
  value?: string | number
  className?: string
}

const BentoCard = forwardRef<HTMLDivElement, BentoCardProps>(
  ({ title, description, icon: Icon, value, className }, ref) => (
    <div
      ref={ref}
      data-slot="bento-card"
      className={cn(
        "group border-border bg-card hover-lift relative overflow-hidden rounded-xl border p-6 transition-all duration-300 hover:shadow-sm",
        className,
      )}
    >
      {/* Radial grid reveal */}
      <div
        data-slot="bento-card-radial"
        aria-hidden
        className="reveal-on-hover absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, oklch(var(--foreground) / 0.04) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
        }}
      />
      {/* Gleam border overlay */}
      <div
        aria-hidden
        className="reveal-on-hover via-muted absolute inset-0 bg-gradient-to-br from-transparent to-transparent"
      />
      <div className="relative">
        <div className="bg-muted mb-3 w-fit rounded-lg p-2">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        {value != null && (
          <p className="mt-2 font-mono text-3xl leading-snug font-bold tracking-tight">{value}</p>
        )}
      </div>
    </div>
  ),
)

BentoCard.displayName = "BentoCard"

export { BentoGrid, BentoCard }
