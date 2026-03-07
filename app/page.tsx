"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import type { HouseholdConfig, ScenarioConfig } from "@/lib/types"
import {
  getDefaultConfig,
  getDefaultScenario,
  generateProjection,
  runMonteCarlo,
  calculateHealthScore,
} from "@/lib/engine"
import { ConfigPanel } from "@/components/dashboard/config-panel"
import { HealthSummary } from "@/components/dashboard/health-summary"
import { ProjectionCharts } from "@/components/dashboard/projection-charts"
import { ProjectionTable } from "@/components/dashboard/projection-table"
import { ScenarioPanel } from "@/components/dashboard/scenario-panel"
import { PrintSummary } from "@/components/dashboard/print-summary"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, FlaskConical, Table, LayoutDashboard } from "lucide-react"

export default function DashboardPage() {
  const [config, setConfig] = useState<HouseholdConfig>(getDefaultConfig)
  const [scenario, setScenario] = useState<ScenarioConfig>(getDefaultScenario)
  const importRef = useRef<HTMLInputElement>(null)

  const projection = useMemo(
    () => generateProjection(config, undefined, config.inflationRate, scenario),
    [config, scenario]
  )
  const monteCarlo = useMemo(() => runMonteCarlo(config, 800, scenario), [config, scenario])
  const healthScore = useMemo(() => calculateHealthScore(config, scenario), [config, scenario])

  const handleConfigChange = (c: HouseholdConfig) => setConfig(c)
  const handleScenarioChange = (s: ScenarioConfig) => setScenario(s)

  const handleExport = useCallback(() => {
    const data = { config, scenario, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `retirewell-${config.person1.name}-${config.person2.name}-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [config, scenario])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.config) {
          const defaults = getDefaultConfig()
          setConfig({
            ...defaults, ...data.config,
            person1: { ...defaults.person1, ...data.config.person1, bedAndIsa: { ...defaults.person1.bedAndIsa, untilExhausted: true, ...(data.config.person1?.bedAndIsa ?? {}) } },
            person2: { ...defaults.person2, ...data.config.person2, bedAndIsa: { ...defaults.person2.bedAndIsa, untilExhausted: true, ...(data.config.person2?.bedAndIsa ?? {}) } },
            withdrawalConfig: { ...defaults.withdrawalConfig, ...(data.config.withdrawalConfig ?? {}) },
            spendingPhases: data.config.spendingPhases ?? [],
          })
        }
        if (data.scenario) {
          const s = data.scenario
          setScenario({
            ...getDefaultScenario(), ...s,
            reduceSpending: s.reduceSpending ?? s.reduceDrawdown ?? false,
            reducedSpendingAmount: s.reducedSpendingAmount ?? s.reducedAmount ?? 28000,
            reduceSpendingFromAge: s.reduceSpendingFromAge ?? 70,
            reduceSpendingForYears: s.reduceSpendingForYears ?? s.reduceForYears ?? 5,
          })
        }
      } catch { alert("Could not read file — make sure it's a valid RetireWell export.") }
    }
    reader.readAsText(file)
    e.target.value = ""
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* A — Static header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <svg className="size-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground leading-none tracking-tight">RetireWell</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Retirement Health Dashboard</p>
          </div>
          <PrintSummary config={config} score={healthScore} projection={projection} />
        </div>

        {/* Hidden file input for import */}
        <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

        {/* Desktop layout */}
        <div className="hidden lg:grid grid-cols-12 gap-6">
          {/* B — Left sidebar */}
          <aside className="col-span-4 flex flex-col gap-6">
            <ConfigPanel
              config={config}
              onChange={handleConfigChange}
              onImport={() => importRef.current?.click()}
              onExport={handleExport}
            />
            <ScenarioPanel scenario={scenario} onChange={handleScenarioChange} />
          </aside>

          {/* Right content */}
          <div className="col-span-8 flex flex-col gap-6">
            {/* C + D + E */}
            <HealthSummary score={healthScore} config={config} />
            {/* F */}
            <ProjectionTable projection={projection} />
            {/* G slot (Account Breakdown) + H (Historical) */}
            <ProjectionCharts projection={projection} monteCarlo={monteCarlo} config={config} scenario={scenario} />
          </div>
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden flex flex-col gap-6">
          <HealthSummary score={healthScore} config={config} />
          <Tabs defaultValue="charts">
            <TabsList className="w-full">
              <TabsTrigger value="charts" className="flex-1 text-xs gap-1.5"><LayoutDashboard className="size-3.5" /><span className="hidden sm:inline">Charts</span></TabsTrigger>
              <TabsTrigger value="table" className="flex-1 text-xs gap-1.5"><Table className="size-3.5" /><span className="hidden sm:inline">Table</span></TabsTrigger>
              <TabsTrigger value="scenarios" className="flex-1 text-xs gap-1.5"><FlaskConical className="size-3.5" /><span className="hidden sm:inline">Scenarios</span></TabsTrigger>
              <TabsTrigger value="settings" className="flex-1 text-xs gap-1.5"><Settings className="size-3.5" /><span className="hidden sm:inline">Settings</span></TabsTrigger>
            </TabsList>
            <TabsContent value="charts" className="mt-4"><ProjectionCharts projection={projection} monteCarlo={monteCarlo} config={config} scenario={scenario} /></TabsContent>
            <TabsContent value="table" className="mt-4"><ProjectionTable projection={projection} /></TabsContent>
            <TabsContent value="scenarios" className="mt-4"><ScenarioPanel scenario={scenario} onChange={handleScenarioChange} /></TabsContent>
            <TabsContent value="settings" className="mt-4">
              <ConfigPanel config={config} onChange={handleConfigChange} onImport={() => importRef.current?.click()} onExport={handleExport} />
            </TabsContent>
          </Tabs>
        </div>

      </div>

      <footer className="border-t bg-card/50 mt-8">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground text-center">
            This tool provides estimates only and does not constitute financial advice. Tax rules and rates may change. Consult a qualified financial adviser for personalised guidance.
          </p>
        </div>
      </footer>
    </main>
  )
}
