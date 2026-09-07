"use client"

import { motion, useInView } from "motion/react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/forge/utils"

export interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}

// Scroll-reveal wrapper. SSR renders the initial (visible-in-DOM) state so
// content stays crawlable; the animation only starts after hydration and once
// the element enters the viewport (once: true).
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setHydrated(true), 50)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <motion.div
      ref={ref}
      className={className ? cn(className) : undefined}
      initial={{ opacity: 0, y }}
      animate={hydrated && inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  )
}
