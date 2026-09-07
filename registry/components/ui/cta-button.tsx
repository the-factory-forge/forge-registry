import { Link } from "@/components/forge/ui/link"
import { cn } from "@/lib/forge/utils"

export type CtaVariant = "primary" | "secondary" | "outline" | "onDark"
export type CtaSize = "default" | "lg"

const variantClasses: Record<CtaVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/40",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/90 focus-visible:ring-secondary/40",
  outline:
    "border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring/40",
  onDark:
    "bg-background text-foreground hover:bg-background/90 focus-visible:ring-background/50",
}

const sizeClasses: Record<CtaSize, string> = {
  default: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0"

export interface CtaButtonProps {
  children: React.ReactNode
  variant?: CtaVariant
  size?: CtaSize
  className?: string
}

export function CtaLink({
  href,
  children,
  variant = "primary",
  size = "default",
  className,
}: CtaButtonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
    >
      {children}
    </Link>
  )
}

export function CtaExternal({
  href,
  children,
  variant = "primary",
  size = "default",
  className,
}: CtaButtonProps & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
    >
      {children}
    </a>
  )
}
