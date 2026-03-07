"use client"

import type { ScenarioConfig } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FlaskConical, TrendingDown, HeartPulse, Clock, Wallet, RotateCcw, PoundSterling } from "lucide-react"
import { getDefaultScenario } from "@/lib/engine"

interface ScenarioPanelProps {
  scenario: ScenarioConfig
  onChange: (s: ScenarioConfig) => void
}

function CurrencyInput({ value, onChange, id, disabled }: { value: number; onChange: (v: number) => void; id?: string; disabled?: boolean }) {
  return (
    <div className="relative">
      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input
        id={id}
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="pl-8"
        disabled={disabled}
      />
    </div>
  )
}

export function ScenarioPanel({ scenario, onChange }: ScenarioPanelProps) {
  const update = (partial: Partial<ScenarioConfig>) => onChange({ ...scenario, ...partial })

  const hasChanges = JSON.stringify(scenario) !== JSON.stringify(getDefaultScenario())

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 shadow-sm">
                <FlaskConical className="size-5 text-white" />
              </div>
              What If Scenarios
            </CardTitle>
            <CardDescription>Test how changes would affect your financial outlook</CardDescription>
          </div>
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(getDefaultScenario())}
              className="h-7 text-xs text-muted-foreground"
            >
              <RotateCcw className="size-3 mr-1" /> Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Extra spending */}
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-chart-4" />
            <h4 className="text-sm font-medium">Extra Annual Spending</h4>
          </div>
          <p className="text-xs text-muted-foreground">What if you spent more each year?</p>
          <CurrencyInput
            value={scenario.extraSpending}
            onChange={(v) => update({ extraSpending: v })}
          />
          {scenario.extraSpending > 0 && (
            <Slider
              value={[scenario.extraSpending]}
              onValueChange={([v]) => update({ extraSpending: v })}
              min={0}
              max={30000}
              step={1000}
            />
          )}
        </div>

        {/* Market crash */}
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-destructive" />
              <h4 className="text-sm font-medium">Market Crash</h4>
            </div>
            <Switch
              checked={scenario.marketCrash}
              onCheckedChange={(v) => update({ marketCrash: v })}
              aria-label="Toggle market crash scenario"
            />
          </div>
          <p className="text-xs text-muted-foreground">What if markets dropped significantly next year?</p>
          {scenario.marketCrash && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Drop percentage</Label>
                <span className="text-sm font-semibold text-destructive">{scenario.marketCrashPercent}%</span>
              </div>
              <Slider
                value={[scenario.marketCrashPercent]}
                onValueChange={([v]) => update({ marketCrashPercent: v })}
                min={5}
                max={60}
                step={5}
              />
            </div>
          )}
        </div>

        {/* Care costs */}
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="size-4 text-chart-1" />
              <h4 className="text-sm font-medium">Long-term Care</h4>
            </div>
            <Switch
              checked={scenario.careCostEnabled}
              onCheckedChange={(v) => update({ careCostEnabled: v })}
              aria-label="Toggle care cost scenario"
            />
          </div>
          <p className="text-xs text-muted-foreground">What if one partner needs residential care?</p>
          {scenario.careCostEnabled && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Starting at age</Label>
                <Input
                  type="number"
                  value={scenario.careCostAge}
                  onChange={(e) => update({ careCostAge: Number(e.target.value) || 85 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Annual care cost</Label>
                <CurrencyInput
                  value={scenario.annualCareCost}
                  onChange={(v) => update({ annualCareCost: v })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Delay state pension */}
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-chart-5" />
              <h4 className="text-sm font-medium">Delay State Pension</h4>
            </div>
            <Switch
              checked={scenario.delayStatePension}
              onCheckedChange={(v) => update({ delayStatePension: v })}
              aria-label="Toggle delay state pension scenario"
            />
          </div>
          <p className="text-xs text-muted-foreground">What if you delayed claiming state pension?</p>
          {scenario.delayStatePension && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Delay by</Label>
                <span className="text-sm font-semibold">{scenario.delayYears} year{scenario.delayYears !== 1 ? "s" : ""}</span>
              </div>
              <Slider
                value={[scenario.delayYears]}
                onValueChange={([v]) => update({ delayYears: v })}
                min={1}
                max={5}
                step={1}
              />
            </div>
          )}
        </div>

        {/* Reduce spending */}
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-success" />
              <h4 className="text-sm font-medium">Reduce Annual Spending</h4>
            </div>
            <Switch
              checked={scenario.reduceSpending ?? false}
              onCheckedChange={(v) => update({ reduceSpending: v })}
              aria-label="Toggle reduce spending scenario"
            />
          </div>
          <p className="text-xs text-muted-foreground">Model a period of lower spending — e.g. slow-go years or a planned belt-tightening phase.</p>
          {scenario.reduceSpending && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Reduce annual spending to</Label>
                <CurrencyInput
                  value={scenario.reducedSpendingAmount ?? 28000}
                  onChange={(v) => update({ reducedSpendingAmount: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">From age (older partner)</Label>
                  <Input
                    type="number"
                    value={scenario.reduceSpendingFromAge ?? 80}
                    onChange={(e) => update({ reduceSpendingFromAge: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">For how many years</Label>
                  <Input
                    type="number"
                    value={scenario.reduceSpendingForYears ?? 5}
                    onChange={(e) => update({ reduceSpendingForYears: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Spending reduced to {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(scenario.reducedSpendingAmount ?? 28000)} from age {scenario.reduceSpendingFromAge ?? 80} for {scenario.reduceSpendingForYears ?? 5} years.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
