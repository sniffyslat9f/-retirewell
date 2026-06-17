"use client"

import { ChevronDown } from "lucide-react"

// Small chevron button used to fold/unfold a dashboard section.
export function CollapseToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Collapse section" : "Expand section"}
      aria-expanded={open}
      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
    </button>
  )
}
