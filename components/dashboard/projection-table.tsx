"use client"

import React, { useState } from "react"
import type { YearProjection } from "@/lib/types"
import { formatCurrency } from "@/lib/engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, Flag, ChevronDown, ChevronUp } from "lucide-react"

interface ProjectionTableProps {
  projection: YearProjection[]
}

export function ProjectionTable({ projection }: ProjectionTableProps) {
  const [showAll, setShowAll] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const visibleRows = showAll ? projection.slice(0, 40) : projection.slice(0, 15)

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setCollapsed(v => !v)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 shadow-sm">
              <Table className="size-5 text-white" />
            </div>
            Year-by-Year Projection
          </CardTitle>
          {collapsed ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
        </div>
        <CardDescription>Detailed annual breakdown in today's £ — all figures are inflation-adjusted</CardDescription>
      </CardHeader>
      {!collapsed && <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-xs" role="table">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 text-left font-medium text-muted-foreground whitespace-nowrap" scope="col">Year</th>
                <th className="py-2 px-3 text-left font-medium text-muted-foreground whitespace-nowrap" scope="col">Ages</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap" scope="col">Portfolio</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap" scope="col">Withdrawals</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap" scope="col">State Pension</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap" scope="col">Other Income</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap" scope="col">Income Tax</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap" scope="col">CGT</th>
                <th className="py-2 pl-3 text-right font-medium text-muted-foreground whitespace-nowrap" scope="col">Net Income</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => {
                const isDepletion = row.portfolioValue <= 0 && (idx === 0 || (projection[idx - 1]?.portfolioValue ?? 0) > 0)
                const hasMilestone = !!row.milestone
                return (
                  <React.Fragment key={row.year}>
                    <tr className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${isDepletion ? "bg-destructive/5" : hasMilestone ? "bg-primary/3" : ""}`}>
                      <td className="py-2 pr-3 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {hasMilestone && <Flag className="size-3 text-primary shrink-0" />}
                          {row.year}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{row.age1} / {row.age2}</td>
                      <td className={`py-2 px-3 text-right font-mono whitespace-nowrap ${row.portfolioValue <= 0 ? "text-destructive font-semibold" : ""}`}>
                        {formatCurrency(row.portfolioValue)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap">{formatCurrency(row.withdrawals)}</td>
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap">{formatCurrency(row.statePensionIncome)}</td>
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap">{formatCurrency(row.otherIncome)}</td>
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap text-destructive">{formatCurrency(row.incomeTax)}</td>
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap text-destructive">{formatCurrency(row.cgt)}</td>
                      <td className="py-2 pl-3 text-right font-mono font-medium whitespace-nowrap">{formatCurrency(row.netIncome)}</td>
                    </tr>
                    {hasMilestone && (
                      <tr className="border-b border-primary/20 bg-primary/5">
                        <td colSpan={9} className="py-1.5 px-3 text-xs text-primary font-medium">
                          📍 {row.milestone}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {projection.length > 15 && (
          <div className="mt-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs">
              {showAll ? "Show fewer years" : `Show all ${Math.min(40, projection.length)} years`}
            </Button>
          </div>
        )}
      </CardContent>}
    </Card>
  )
}
