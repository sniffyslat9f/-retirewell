"use client"

import { useState } from "react"
import type { HealthScore, HouseholdConfig } from "@/lib/types"
import { formatCurrency } from "@/lib/engine"
import { TrendingUp, PoundSterling } from "lucide-react"
import { CollapseToggle } from "./collapse-toggle"

interface HealthSummaryProps {
  score: HealthScore
  config: HouseholdConfig
}

function IOS({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${color} shadow-sm`}>
      {children}
    </div>
  )
}

function SemiGauge({ prob }: { prob: number }) {
  const cx = 100, cy = 105, r = 85, sw = 14
  const leftX = cx - r
  const rightX = cx + r
  const angleDeg = 180 - (Math.max(0, Math.min(100, prob)) / 100) * 180
  const angleRad = (angleDeg * Math.PI) / 180
  const nx = cx + r * Math.cos(angleRad)
  const ny = cy - r * Math.sin(angleRad)
  const fillColor = prob >= 80 ? "#4f46e5" : prob >= 60 ? "#f59e0b" : "#ef4444"

  return (
    <svg viewBox="0 0 200 120" width="100%" style={{ maxWidth: 220 }}>
      <path
        d={`M ${leftX} ${cy} A ${r} ${r} 0 0 1 ${rightX} ${cy}`}
        fill="none" stroke="#e5e7eb" strokeWidth={sw} strokeLinecap="round"
      />
      {prob > 1 && (
        <path
          d={`M ${leftX} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
          fill="none" stroke={fillColor} strokeWidth={sw} strokeLinecap="round"
        />
      )}
      <circle cx={nx} cy={ny} r={7} fill="white" stroke={fillColor} strokeWidth={3} />
    </svg>
  )
}

export function HealthSummary({ score, config }: HealthSummaryProps) {
  const totalPortfolio =
    config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments + config.person1.cashSavings +
    config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments + config.person2.cashSavings

  const prob = score.survivalProbability95
  const fillColor = prob >= 80 ? "#4f46e5" : prob >= 60 ? "#f59e0b" : "#ef4444"
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-muted-foreground">Overview</span>
        <CollapseToggle open={open} onToggle={() => setOpen(!open)} />
      </div>
      {open && (
    <div className="grid grid-cols-3 gap-4" style={{ minHeight: 220 }}>

      {/* Left two-thirds — two KPI tiles stacked */}
      <div className="col-span-2 grid grid-rows-2 gap-4">

        <div className="rounded-xl border bg-card p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <IOS color="bg-emerald-500"><TrendingUp className="size-5 text-white" /></IOS>
            <span className="text-sm font-medium text-muted-foreground">Total Portfolio</span>
          </div>
          <p className="text-5xl font-bold text-foreground tabular-nums tracking-tight mt-3">
            {formatCurrency(totalPortfolio)}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <IOS color="bg-sky-500"><PoundSterling className="size-5 text-white" /></IOS>
            <span className="text-sm font-medium text-muted-foreground">Annual Spend</span>
          </div>
          <p className="text-5xl font-bold text-foreground tabular-nums tracking-tight mt-3">
            {formatCurrency(config.annualSpending)}
          </p>
        </div>
      </div>

      {/* Right third — Monte Carlo speedo */}
      <div className="col-span-1 rounded-xl border bg-card p-5 flex flex-col">
        <div className="flex items-center gap-2.5 mb-2">
          <IOS color="bg-indigo-500">
            <svg className="size-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0 1 10 10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12a10 10 0 0 1 10-10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l3-5" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </IOS>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Monte Carlo</p>
            <p className="text-xs text-muted-foreground leading-tight">Survival probability to age 95</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <SemiGauge prob={Math.max(0, prob)} />
          <p className="text-5xl font-bold tabular-nums -mt-2" style={{ color: fillColor }}>
            {prob < 0 ? "N/A" : `${prob}%`}
          </p>
          <p className="text-xs text-slate-400 mt-1">{prob < 0 ? "Extend projection years to assess" : "Probability of success"}</p>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold mt-2">
            Current plan
          </span>
        </div>
      </div>

    </div>
      )}
    </div>
  )
}
