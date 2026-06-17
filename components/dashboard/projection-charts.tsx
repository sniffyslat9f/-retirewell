"use client"
import React from "react"

import { useMemo, useState } from "react"
import type { MonteCarloResult, YearProjection, HouseholdConfig, ScenarioConfig } from "@/lib/types"
import { formatCurrency } from "@/lib/engine"
import { HISTORICAL_START_YEARS, NOTABLE_YEARS, runHistoricalSequence, getHistoricalRealReturnsArray } from "@/lib/historical-returns"
import { generateProjection } from "@/lib/engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AreaChart, Area, CartesianGrid, Line, LineChart, ComposedChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine,
} from "recharts"
import { Layers, History, TrendingUp, Percent } from "lucide-react"

// Standard iOS-style icon badge — size-9 square rounded-xl, used across all components
function IOS({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${color} shadow-sm`}>
      {children}
    </div>
  )
}

interface ProjectionChartsProps {
  projection: YearProjection[]
  monteCarlo: MonteCarloResult
  config: HouseholdConfig
  scenario?: ScenarioConfig
}

// Tooltip for £ values
function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.filter(e => e.value > 1).map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Tooltip for % stacked area
function PctTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{entry.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function HistoricalTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload: { returnPct?: number } }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  const returnPct = payload[0]?.payload?.returnPct
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.filter(e => e.name !== "returnPct").map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{formatCurrency(entry.value)}</span>
        </div>
      ))}
      {returnPct !== undefined && (
        <p className={`text-xs mt-1 font-medium ${returnPct >= 0 ? "text-green-600" : "text-red-500"}`}>
          Real return: {returnPct >= 0 ? "+" : ""}{(returnPct * 100).toFixed(1)}%
        </p>
      )}
    </div>
  )
}

function RateTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{entry.value.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  )
}

// Y-axis tick formatter — £ values
function fmt(v: number): string {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `£${(v / 1_000).toFixed(0)}k`
  return `£${v}`
}

export function ProjectionCharts({ projection, monteCarlo, config, scenario }: ProjectionChartsProps) {
  const [historicalStartYear, setHistoricalStartYear] = useState<number>(2000)

  // Account breakdown — absolute £ values, log scale, zeros floored at 1
  const accountBreakdownData = useMemo(() => projection.map((p) => ({
    year: p.year.toString(),
    ISA:  p.isaBalance,
    GIA:  p.generalBalance,
    SIPP: p.sippBalance,
    Cash: p.cashBalance,
  })), [projection])

  // Monte Carlo confidence bands — log scale, floor at 1
  const monteCarloData = useMemo(() => monteCarlo.years.map((year, idx) => ({
    year: year.toString(),
    p10:    monteCarlo.percentile10[idx],
    p25:    monteCarlo.percentile25[idx],
    median: monteCarlo.median[idx],
    p75:    monteCarlo.percentile75[idx],
    p90:    monteCarlo.percentile90[idx],
  })), [monteCarlo])

  // Historical sequence — log scale, floor at 1
  const historicalData = useMemo(() => {
    const totalPortfolio =
      config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments + config.person1.cashSavings +
      config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments + config.person2.cashSavings
    const otherIncome = config.person2.otherIncome.reduce((s, i) => s + i.annualAmount, 0)
    const sequence = runHistoricalSequence(
      historicalStartYear, totalPortfolio,
      (yearIdx) => {
        const age1 = config.person1.age + yearIdx, age2 = config.person2.age + yearIdx
        const sp1 = age1 >= config.person1.statePensionAge ? config.person1.statePensionAmount : 0
        const sp2 = age2 >= config.person2.statePensionAge ? config.person2.statePensionAmount : 0
        return Math.max(0, config.annualSpending - sp1 - sp2 - otherIncome)
      }, config.projectionYears ?? 40
    )
    return sequence.map((s, idx) => ({
      year: `Year ${idx + 1} (${s.year})`,
      historical: s.value,
      median:     monteCarlo.median[idx] ?? 0,
      returnPct:  s.returnPct,
    }))
  }, [historicalStartYear, config, monteCarlo])

  const historicalFailed = historicalData.some(d => d.historical <= 1)
  const failureYear = historicalData.findIndex(d => d.historical <= 1)

  // Full tax-aware historical projection using actual S&P 500 real returns
  const historicalProjection = useMemo(() => {
    const years = config.projectionYears ?? 40
    const realReturns = getHistoricalRealReturnsArray(historicalStartYear, years)
    return generateProjection(config, 0.05, config.inflationRate ?? 0.025, scenario, realReturns)
  }, [historicalStartYear, config, scenario])

  // Withdrawal rate over time
  const withdrawalRateData = useMemo(() => projection.map((p) => {
    const rate = p.portfolioValue > 0 ? (p.withdrawals / p.portfolioValue) * 100 : 0
    return {
      year: p.year.toString(),
      rate: Math.round(rate * 100) / 100,
    }
  }), [projection])

  return (
    <div className="flex flex-col gap-4">

      {/* G — Account Breakdown (log scale £) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <IOS color="bg-teal-500"><Layers className="size-5 text-white" /></IOS>
            Account Breakdown Over Time
          </CardTitle>
          <CardDescription>Portfolio composition by account type · Today's £</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={accountBreakdownData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} interval={4} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip content={<CurrencyTooltip />} />
                <Area type="monotone" dataKey="ISA"  stroke="#0d9488" fill="#0d948866" />
                <Area type="monotone" dataKey="GIA"  stroke="#3b82f6" fill="#3b82f666" />
                <Area type="monotone" dataKey="SIPP" stroke="#10b981" fill="#10b98166" />
                <Area type="monotone" dataKey="Cash" stroke="#f59e0b" fill="#f59e0b66" />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* H — Historical Sequence (log scale) */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-base">
                <IOS color="bg-rose-500"><History className="size-5 text-white" /></IOS>
                Historical Sequence Testing
              </CardTitle>
              <CardDescription className="mt-1">
                How would your portfolio have performed retiring in a specific year? Uses actual S&P 500 real returns · Today's £
              </CardDescription>
            </div>
            <Select value={historicalStartYear.toString()} onValueChange={(v) => setHistoricalStartYear(Number(v))}>
              <SelectTrigger className="w-[220px] shrink-0 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HISTORICAL_START_YEARS.map(year => (
                  <SelectItem key={year} value={year.toString()} className="text-xs">
                    {NOTABLE_YEARS[year] ?? year.toString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {historicalFailed ? (
            <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium">
              ⚠️ Portfolio exhausted in year {failureYear + 1} ({historicalStartYear + failureYear}) under this sequence
            </div>
          ) : (
            <div className="mt-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 font-medium">
              ✅ Portfolio survives the full 35 years under this historical sequence
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={historicalData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickLine={false} interval={4} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip content={<HistoricalTooltip />} />
                <Line type="monotone" dataKey="median"     name="Median (Monte Carlo)"            stroke="#2a9d8f" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="historical" name={`Historical (${historicalStartYear})`} stroke="#e76f51" strokeWidth={2.5} dot={false} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              Year-by-Year Projection — {historicalStartYear} Historical Sequence · Today's £ (inflation-adjusted)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">Year</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">Ages</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">Portfolio</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">Withdrawals</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">State Pension</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">Other Income</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">Income Tax</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">CGT</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground border-b border-t">Net Income</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalProjection.map((row, idx) => (
                    <React.Fragment key={historicalStartYear + idx}>
                      <tr className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="py-1 px-2 border-b border-border/30">{historicalStartYear + idx}</td>
                        <td className="py-1 px-2 border-b border-border/30 whitespace-nowrap">{row.age1} / {row.age2}</td>
                        <td className={`py-1 px-2 border-b border-border/30 text-right tabular-nums ${row.portfolioValue <= 0 ? "text-destructive font-medium" : ""}`}>{formatCurrency(row.portfolioValue)}</td>
                        <td className="py-1 px-2 border-b border-border/30 text-right tabular-nums">{formatCurrency(row.withdrawals)}</td>
                        <td className="py-1 px-2 border-b border-border/30 text-right tabular-nums">{row.statePensionIncome === 0 ? <span className="text-muted-foreground/40">—</span> : formatCurrency(row.statePensionIncome)}</td>
                        <td className="py-1 px-2 border-b border-border/30 text-right tabular-nums">{row.otherIncome === 0 ? <span className="text-muted-foreground/40">—</span> : formatCurrency(row.otherIncome)}</td>
                        <td className="py-1 px-2 border-b border-border/30 text-right tabular-nums text-destructive">{row.incomeTax === 0 ? <span className="text-muted-foreground/40">—</span> : formatCurrency(row.incomeTax)}</td>
                        <td className="py-1 px-2 border-b border-border/30 text-right tabular-nums text-destructive">{row.cgt === 0 ? <span className="text-muted-foreground/40">—</span> : formatCurrency(row.cgt)}</td>
                        <td className="py-1 px-2 border-b border-border/30 text-right tabular-nums font-medium">{formatCurrency(row.netIncome)}</td>
                      </tr>
                      {row.milestone && (
                        <tr className="bg-muted/40">
                          <td colSpan={9} className="py-0.5 px-2 text-[11px] text-muted-foreground italic border-b border-border/30">
                            📍 {row.milestone}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monte Carlo confidence bands (log scale) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <IOS color="bg-violet-500"><TrendingUp className="size-5 text-white" /></IOS>
            Portfolio Projection — Confidence Bands
          </CardTitle>
          <CardDescription>800 Monte Carlo scenarios showing range of outcomes · Today's £</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monteCarloData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} interval={4} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip content={<CurrencyTooltip />} />
                <Area type="monotone" dataKey="p90"    name="Optimistic (10%)"  stroke="#2a9d8f" strokeWidth={1} fill="#2a9d8f14" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="p75"    name="Good (25%)"        stroke="#2a9d8f" strokeWidth={1} fill="#2a9d8f28" />
                <Line type="monotone" dataKey="median" name="Typical (50%)"     stroke="#2a9d8f" strokeWidth={3} dot={false} />
                <Area type="monotone" dataKey="p25"    name="Cautious (25%)"    stroke="#e76f51" strokeWidth={1} fill="#e76f5114" />
                <Area type="monotone" dataKey="p10"    name="Pessimistic (10%)" stroke="#e76f51" strokeWidth={1} fill="#e76f5108" strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Rate Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <IOS color="bg-orange-500"><Percent className="size-5 text-white" /></IOS>
            Withdrawal Rate Over Time
          </CardTitle>
          <CardDescription>Portfolio withdrawal rate each year — how much of your portfolio you draw down annually</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={withdrawalRateData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} interval={4} />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false}
                />
                <Tooltip content={<RateTooltip />} />
                <ReferenceLine y={4} stroke="#e76f51" strokeDasharray="5 5" strokeWidth={1.5}
                  label={{ value: "4% rule", position: "insideTopRight", fontSize: 10, fill: "#e76f51" }}
                />
                <ReferenceLine y={3.5} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1}
                  label={{ value: "3.5%", position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
                />
                <Line type="monotone" dataKey="rate" name="Withdrawal rate" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
