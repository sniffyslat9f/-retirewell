"use client"

import { useState } from "react"
import type { HouseholdConfig, PersonConfig, AccountType, OtherIncome, AllocationConfig, WithdrawalMethod, SpendingPhase } from "@/lib/types"
import { formatCurrency } from "@/lib/engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Users, PoundSterling, ShieldCheck, Plus, X, GripVertical, TrendingUp, Download, Upload } from "lucide-react"

interface ConfigPanelProps {
  config: HouseholdConfig
  onChange: (config: HouseholdConfig) => void
  onImport?: () => void
  onExport?: () => void
}

const ACCOUNT_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  isa: "ISA",
  sipp: "SIPP/Pension",
  general: "General Investments",
}

const INCOME_TYPES = [
  { value: "rental", label: "Rental Income" },
  { value: "parttime", label: "Part-time Work" },
  { value: "annuity", label: "Annuity" },
  { value: "db_pension", label: "DB Pension" },
  { value: "other", label: "Other" },
] as const

function CurrencyInput({ value, onChange, id }: { value: number; onChange: (v: number) => void; id?: string }) {
  return (
    <div className="relative">
      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input
        id={id}
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="pl-8"
      />
    </div>
  )
}

function PersonForm({
  person,
  label,
  onChange,
}: {
  person: PersonConfig
  label: string
  onChange: (p: PersonConfig) => void
}) {
  const update = (partial: Partial<PersonConfig>) => onChange({ ...person, ...partial })

  const moveDrawdownOrder = (index: number, direction: "up" | "down") => {
    const newOrder = [...person.drawdownOrder]
    const swapIdx = direction === "up" ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]]
    update({ drawdownOrder: newOrder })
  }

  const addOtherIncome = () => {
    update({
      otherIncome: [...person.otherIncome, { label: "", annualAmount: 0, type: "other", increasesWithInflation: true }],
    })
  }

  const removeOtherIncome = (index: number) => {
    update({ otherIncome: person.otherIncome.filter((_, i) => i !== index) })
  }

  const updateOtherIncome = (index: number, partial: Partial<OtherIncome>) => {
    const newIncome = [...person.otherIncome]
    newIncome[index] = { ...newIncome[index], ...partial }
    update({ otherIncome: newIncome })
  }

  const totalPortfolio = person.isaBalance + person.sippBalance + person.generalInvestments + person.cashSavings

  return (
    <div className="flex flex-col gap-6">
      {/* Basic info */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">{label}</h4>
          <Badge variant="outline" className="text-xs font-normal">
            Portfolio: {formatCurrency(totalPortfolio)}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-name`} className="text-xs text-muted-foreground">Name</Label>
            <Input id={`${label}-name`} value={person.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-age`} className="text-xs text-muted-foreground">Age</Label>
            <Input id={`${label}-age`} type="number" value={person.age} onChange={(e) => update({ age: Number(e.target.value) || 0 })} />
          </div>
        </div>
      </div>

      {/* Portfolio balances */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Portfolio Balances</h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-isa`} className="text-xs text-muted-foreground">ISA</Label>
            <CurrencyInput id={`${label}-isa`} value={person.isaBalance} onChange={(v) => update({ isaBalance: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-sipp`} className="text-xs text-muted-foreground">SIPP / Pension</Label>
            <CurrencyInput id={`${label}-sipp`} value={person.sippBalance} onChange={(v) => update({ sippBalance: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-general`} className="text-xs text-muted-foreground">General Investments (GIA)</Label>
            <CurrencyInput id={`${label}-general`} value={person.generalInvestments} onChange={(v) => update({ generalInvestments: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-gia-basis`} className="text-xs text-muted-foreground">GIA Cost Basis <span className="text-muted-foreground/60">(original purchase cost)</span></Label>
            <CurrencyInput id={`${label}-gia-basis`} value={person.giaCostBasis} onChange={(v) => update({ giaCostBasis: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-cash`} className="text-xs text-muted-foreground">Cash Savings</Label>
            <CurrencyInput id={`${label}-cash`} value={person.cashSavings} onChange={(v) => update({ cashSavings: v })} />
          </div>
        </div>
      </div>

      {/* Investment Allocations */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Investment Allocation</h5>
        <p className="text-xs text-muted-foreground">Stocks vs bonds mix per account. Higher stocks = higher growth potential but more volatility.</p>
        {(["isa", "sipp", "general"] as const).map((account) => {
          const allocationKey = `${account}Allocation` as "isaAllocation" | "sippAllocation" | "generalAllocation"
          const allocation: AllocationConfig = person[allocationKey]
          const accountLabels = { isa: "ISA", sipp: "SIPP / Pension", general: "GIA" }
          // Blended nominal return: stocks 10%, bonds 4.5%
          const nominalReturn = (allocation.stocksPct / 100) * 10 + (1 - allocation.stocksPct / 100) * 4.5
          // Real return after 2.5% inflation
          const realReturn = nominalReturn - 2.5
          return (
            <div key={account} className="flex flex-col gap-2 rounded-lg border p-3 bg-secondary/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{accountLabels[account]}</span>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-blue-500 font-medium">{allocation.stocksPct}% stocks</span>
                  <span>·</span>
                  <span className="text-amber-500 font-medium">{100 - allocation.stocksPct}% bonds</span>
                </div>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[allocation.stocksPct]}
                onValueChange={([v]) => update({ [allocationKey]: { stocksPct: v } })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>All bonds</span>
                <span className="text-green-600 font-medium">{nominalReturn.toFixed(1)}% nominal · {realReturn.toFixed(1)}% real</span>
                <span>All stocks</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bed & ISA */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bed & ISA</h5>
        <p className="text-xs text-muted-foreground">
          Sell GIA assets and repurchase inside an ISA wrapper. Crystallises CGT now but shelters future growth from tax. Max £20,000/year per person.
        </p>
        <div className="rounded-lg border p-3 bg-secondary/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Enable Bed & ISA for {person.name}</span>
            <Switch
              checked={person.bedAndIsa.enabled}
              onCheckedChange={(v) => update({ bedAndIsa: { ...person.bedAndIsa, enabled: v } })}
            />
          </div>
          {person.bedAndIsa.enabled && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Annual transfer amount (max £20,000)</Label>
                <CurrencyInput
                  value={person.bedAndIsa.annualAmount}
                  onChange={(v) => update({ bedAndIsa: { ...person.bedAndIsa, annualAmount: Math.min(20000, v) } })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Start age</Label>
                <Input
                  type="number"
                  value={person.bedAndIsa.startAge || ""}
                  onChange={(e) => update({ bedAndIsa: { ...person.bedAndIsa, startAge: Number(e.target.value) || 0 } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium">Continue until GIA is exhausted</span>
                  <p className="text-xs text-muted-foreground">Transfer each year until the GIA reaches £0</p>
                </div>
                <Switch
                  checked={person.bedAndIsa.untilExhausted ?? true}
                  onCheckedChange={(v) => update({ bedAndIsa: { ...person.bedAndIsa, untilExhausted: v } })}
                />
              </div>
              {!person.bedAndIsa.untilExhausted && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Number of years</Label>
                  <Input
                    type="number"
                    value={person.bedAndIsa.years || ""}
                    onChange={(e) => update({ bedAndIsa: { ...person.bedAndIsa, years: Number(e.target.value) || 0 } })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total transfer: {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(person.bedAndIsa.annualAmount * person.bedAndIsa.years)} over {person.bedAndIsa.years} years from age {person.bedAndIsa.startAge}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drawdown order */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drawdown Order</h5>
        <div className="flex flex-col gap-1.5 rounded-lg border bg-secondary/30 p-2">
          {person.drawdownOrder.map((account, idx) => (
            <div key={account} className="flex items-center gap-2 rounded-md bg-card px-3 py-2">
              <GripVertical className="size-3.5 text-muted-foreground" />
              <span className="text-sm flex-1">{ACCOUNT_LABELS[account]}</span>
              <span className="text-xs text-muted-foreground mr-1">{idx + 1}</span>
              <div className="flex gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => moveDrawdownOrder(idx, "up")}
                  disabled={idx === 0}
                  aria-label={`Move ${ACCOUNT_LABELS[account]} up`}
                >
                  <span className="text-xs">&uarr;</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => moveDrawdownOrder(idx, "down")}
                  disabled={idx === person.drawdownOrder.length - 1}
                  aria-label={`Move ${ACCOUNT_LABELS[account]} down`}
                >
                  <span className="text-xs">&darr;</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* State pension */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">State Pension</h5>
        <div className="flex items-center justify-between">
          <Label htmlFor={`${label}-sp-receiving`} className="text-sm">Currently receiving</Label>
          <Switch
            id={`${label}-sp-receiving`}
            checked={person.receivingStatePension}
            onCheckedChange={(v) => update({ receivingStatePension: v })}
          />
        </div>
        {!person.receivingStatePension && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${label}-sp-age`} className="text-xs text-muted-foreground">Start age</Label>
            <Input
              id={`${label}-sp-age`}
              type="number"
              value={person.statePensionAge}
              onChange={(e) => update({ statePensionAge: Number(e.target.value) || 67 })}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${label}-sp-amount`} className="text-xs text-muted-foreground">Annual amount</Label>
          <CurrencyInput id={`${label}-sp-amount`} value={person.statePensionAmount} onChange={(v) => update({ statePensionAmount: v })} />
        </div>
      </div>

      {/* Tax settings */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tax Settings</h5>
        <div className="flex items-center justify-between">
          <Label htmlFor={`${label}-lump-sum`} className="text-sm">25% tax-free lump sum taken</Label>
          <Switch
            id={`${label}-lump-sum`}
            checked={person.taxFreeLumpSumTaken}
            onCheckedChange={(v) => update({ taxFreeLumpSumTaken: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor={`${label}-scottish`} className="text-sm">Scottish tax bands</Label>
          <Switch
            id={`${label}-scottish`}
            checked={person.useScottishTax}
            onCheckedChange={(v) => update({ useScottishTax: v })}
          />
        </div>
      </div>

      {/* Other income */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Other Income</h5>
          <Button variant="outline" size="sm" onClick={addOtherIncome} className="h-7 text-xs">
            <Plus className="size-3 mr-1" /> Add
          </Button>
        </div>
        {person.otherIncome.map((income, idx) => (
          <div key={idx} className="flex flex-col gap-2 rounded-lg border p-3 bg-secondary/20">
            <div className="flex items-center gap-2">
              <Select
                value={income.type}
                onValueChange={(v) => updateOtherIncome(idx, { type: v as OtherIncome["type"] })}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeOtherIncome(idx)}
                aria-label="Remove income source"
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  value={income.label}
                  onChange={(e) => updateOtherIncome(idx, { label: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="e.g. Rental property"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Annual amount</Label>
                <CurrencyInput value={income.annualAmount} onChange={(v) => updateOtherIncome(idx, { annualAmount: v })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-background/60 px-2 py-1.5">
              <div className="flex flex-col">
                <Label className="text-xs">Rises with inflation</Label>
                <span className="text-[10px] text-muted-foreground">Turn off for a level annuity or fixed pension (its value erodes over time)</span>
              </div>
              <Switch
                checked={income.increasesWithInflation !== false}
                onCheckedChange={(checked) => updateOtherIncome(idx, { increasesWithInflation: checked })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ConfigPanel({ config, onChange, onImport, onExport }: ConfigPanelProps) {
  const update = (partial: Partial<HouseholdConfig>) => onChange({ ...config, ...partial })
  const updatePerson1 = (p: PersonConfig) => update({ person1: p })
  const updatePerson2 = (p: PersonConfig) => update({ person2: p })

  const wc = config.withdrawalConfig ?? { method: "constant" as WithdrawalMethod, percentOfPortfolio: 4, floorPct: 2.5, ceilingPct: 5, guardrailLower: 20, guardrailUpper: 20 }
  const updateWc = (partial: Partial<typeof wc>) => update({ withdrawalConfig: { ...wc, ...partial } })

  const phases = config.spendingPhases ?? []
  const addPhase = () => update({ spendingPhases: [...phases, { label: "New phase", annualAmount: config.annualSpending, untilAge: 85 }] })
  const updatePhase = (i: number, partial: Partial<SpendingPhase>) => {
    const next = [...phases]; next[i] = { ...next[i], ...partial }; update({ spendingPhases: next })
  }
  const removePhase = (i: number) => update({ spendingPhases: phases.filter((_, idx) => idx !== i) })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
              <Users className="size-5 text-primary-foreground" />
            </div>
            Household Configuration
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {onImport && (
              <Button variant="outline" size="sm" onClick={onImport} className="text-xs gap-1 h-7 px-2">
                <Upload className="size-3" />Import
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} className="text-xs gap-1 h-7 px-2">
                <Download className="size-3" />Export
              </Button>
            )}
          </div>
        </div>
        <CardDescription>Enter your current financial situation below</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* Household spending */}
        <div className="flex flex-col gap-3 rounded-lg bg-primary/5 p-4 border border-primary/10">
          <div className="flex items-center gap-2">
            <PoundSterling className="size-4 text-primary" />
            <Label htmlFor="annual-spending" className="text-sm font-medium">Annual Household Spending</Label>
          </div>
          <CurrencyInput id="annual-spending" value={config.annualSpending} onChange={(v) => update({ annualSpending: v })} />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="projection-years" className="text-xs text-muted-foreground">Projection Years</Label>
              <input
                id="projection-years-input"
                type="number"
                min={20} max={60} step={1}
                value={config.projectionYears ?? 40}
                onChange={(e) => { const v = Math.min(60, Math.max(20, parseInt(e.target.value) || 40)); update({ projectionYears: v }) }}
                className="w-14 text-right text-xs font-medium border border-input rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Slider id="projection-years" min={20} max={60} step={1}
              value={[config.projectionYears ?? 40]}
              onValueChange={([v]) => update({ projectionYears: v })} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>20 yrs</span><span>Default: 40 years</span><span>60 yrs</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="inflation-rate" className="text-xs text-muted-foreground">Inflation Rate</Label>
              <span className="text-xs font-medium text-muted-foreground">{(config.inflationRate * 100).toFixed(1)}%</span>
            </div>
            <Slider id="inflation-rate" min={0} max={10} step={0.1} value={[config.inflationRate * 100]} onValueChange={([v]) => update({ inflationRate: v / 100 })} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span><span>Bank of England target: 2%</span><span>10%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Triple Lock State Pension</Label>
              <p className="text-xs text-muted-foreground">State pension grows at max of inflation, earnings, or 2.5%</p>
            </div>
            <Switch checked={config.tripleLockStatePension ?? false} onCheckedChange={(v) => update({ tripleLockStatePension: v })} />
          </div>
        </div>

        {/* Spending phases */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-medium">Spending Phases</h5>
              <p className="text-xs text-muted-foreground">Model go-go / slow-go / no-go spending stages. Leave empty to use flat spending above.</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addPhase}>
              <Plus className="size-3" /> Add phase
            </Button>
          </div>
          {phases.length > 0 && (
            <div className="flex flex-col gap-2">
              {phases.map((phase, i) => (
                <div key={i} className="rounded-lg border p-3 bg-secondary/20 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input value={phase.label} onChange={(e) => updatePhase(i, { label: e.target.value })} className="h-7 text-xs flex-1" placeholder="Phase label" />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePhase(i)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Annual spending</Label>
                      <CurrencyInput value={phase.annualAmount} onChange={(v) => updatePhase(i, { annualAmount: v })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Until older partner age</Label>
                      <Input type="number" value={phase.untilAge || ""} onChange={(e) => updatePhase(i, { untilAge: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Phases apply in order — the last phase continues indefinitely.</p>
            </div>
          )}
        </div>

        {/* Withdrawal method */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h5 className="text-xs font-medium">Withdrawal Method</h5>
          </div>
          <Select value={wc.method} onValueChange={(v) => updateWc({ method: v as WithdrawalMethod })}>
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="constant">Constant Amount — fixed spending in real terms</SelectItem>
              <SelectItem value="percent">% of Portfolio — spend a fixed % each year</SelectItem>
              <SelectItem value="vanguard_dynamic">Vanguard Dynamic — % of portfolio with floor & ceiling</SelectItem>
              <SelectItem value="guyton_klinger">Guyton-Klinger Guardrails — adjust on performance</SelectItem>
            </SelectContent>
          </Select>

          {wc.method === "percent" && (
            <div className="rounded-lg border p-3 bg-secondary/20 flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">% of portfolio to withdraw annually</Label>
              <div className="flex items-center gap-2">
                <Slider min={1} max={10} step={0.1} value={[wc.percentOfPortfolio ?? 4]} onValueChange={([v]) => updateWc({ percentOfPortfolio: v })} className="flex-1" />
                <span className="text-xs font-medium w-10 text-right">{(wc.percentOfPortfolio ?? 4).toFixed(1)}%</span>
              </div>
            </div>
          )}

          {wc.method === "vanguard_dynamic" && (
            <div className="rounded-lg border p-3 bg-secondary/20 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">Target a % of portfolio each year, but spending can't rise or fall beyond the floor/ceiling from the prior year.</p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Target % of portfolio</Label>
                <div className="flex items-center gap-2">
                  <Slider min={1} max={10} step={0.1} value={[wc.percentOfPortfolio ?? 4]} onValueChange={([v]) => updateWc({ percentOfPortfolio: v })} className="flex-1" />
                  <span className="text-xs font-medium w-10 text-right">{(wc.percentOfPortfolio ?? 4).toFixed(1)}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Max annual cut</Label>
                  <div className="flex items-center gap-2">
                    <Slider min={0} max={10} step={0.5} value={[wc.floorPct ?? 2.5]} onValueChange={([v]) => updateWc({ floorPct: v })} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{(wc.floorPct ?? 2.5).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Max annual rise</Label>
                  <div className="flex items-center gap-2">
                    <Slider min={0} max={10} step={0.5} value={[wc.ceilingPct ?? 5]} onValueChange={([v]) => updateWc({ ceilingPct: v })} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{(wc.ceilingPct ?? 5).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {wc.method === "guyton_klinger" && (
            <div className="rounded-lg border p-3 bg-secondary/20 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">Spending adjusts based on portfolio performance. If withdrawal rate rises too high, cut by 10%. If it falls low, take a raise of 10%.</p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Initial % of portfolio</Label>
                <div className="flex items-center gap-2">
                  <Slider min={1} max={10} step={0.1} value={[wc.percentOfPortfolio ?? 4]} onValueChange={([v]) => updateWc({ percentOfPortfolio: v })} className="flex-1" />
                  <span className="text-xs font-medium w-10 text-right">{(wc.percentOfPortfolio ?? 4).toFixed(1)}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Lower guardrail (cut trigger)</Label>
                  <div className="flex items-center gap-2">
                    <Slider min={5} max={40} step={5} value={[wc.guardrailLower ?? 20]} onValueChange={([v]) => updateWc({ guardrailLower: v })} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{wc.guardrailLower ?? 20}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Upper guardrail (raise trigger)</Label>
                  <div className="flex items-center gap-2">
                    <Slider min={5} max={40} step={5} value={[wc.guardrailUpper ?? 20]} onValueChange={([v]) => updateWc({ guardrailUpper: v })} className="flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{wc.guardrailUpper ?? 20}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Return assumptions */}
        <div className="flex flex-col gap-3">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Return Assumptions</h5>
          <div className="rounded-lg border p-3 bg-secondary/20 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Stocks (nominal annual return)</Label>
                <span className="text-xs font-medium">{((config.stocksReturn ?? 0.10) * 100).toFixed(1)}%</span>
              </div>
              <Slider min={3} max={15} step={0.5} value={[(config.stocksReturn ?? 0.10) * 100]} onValueChange={([v]) => update({ stocksReturn: v / 100 })} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>3%</span><span>S&P 500 historical avg: 10%</span><span>15%</span></div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Bonds (nominal annual return)</Label>
                <span className="text-xs font-medium">{((config.bondsReturn ?? 0.045) * 100).toFixed(1)}%</span>
              </div>
              <Slider min={1} max={8} step={0.25} value={[(config.bondsReturn ?? 0.045) * 100]} onValueChange={([v]) => update({ bondsReturn: v / 100 })} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>1%</span><span>Long-run avg: 4.5%</span><span>8%</span></div>
            </div>
            <p className="text-xs text-muted-foreground">Real return = nominal − {(config.inflationRate * 100).toFixed(1)}% inflation. Currently: stocks {((( config.stocksReturn ?? 0.10) - config.inflationRate) * 100).toFixed(1)}% real, bonds {(((config.bondsReturn ?? 0.045) - config.inflationRate) * 100).toFixed(1)}% real.</p>
          </div>
        </div>

        {/* Costs & taxable-income assumptions */}
        <div className="flex flex-col gap-3">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Costs &amp; Taxable Income</h5>
          <div className="rounded-lg border p-3 bg-secondary/20 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Annual charges (platform + funds)</Label>
                <span className="text-xs font-medium">{((config.annualCharges ?? 0.005) * 100).toFixed(2)}%</span>
              </div>
              <Slider min={0} max={2} step={0.05} value={[(config.annualCharges ?? 0.005) * 100]} onValueChange={([v]) => update({ annualCharges: v / 100 })} />
              <p className="text-xs text-muted-foreground">A yearly fee deducted from investment growth.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Dividend yield on taxable account</Label>
                <span className="text-xs font-medium">{((config.dividendYield ?? 0.02) * 100).toFixed(1)}%</span>
              </div>
              <Slider min={0} max={6} step={0.25} value={[(config.dividendYield ?? 0.02) * 100]} onValueChange={([v]) => update({ dividendYield: v / 100 })} />
              <p className="text-xs text-muted-foreground">Income from your General (non-ISA) holdings — taxed yearly at dividend rates. ISAs &amp; pensions are exempt.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Cash interest rate</Label>
                <span className="text-xs font-medium">{((config.cashInterestRate ?? 0.035) * 100).toFixed(1)}%</span>
              </div>
              <Slider min={0} max={7} step={0.25} value={[(config.cashInterestRate ?? 0.035) * 100]} onValueChange={([v]) => update({ cashInterestRate: v / 100 })} />
              <p className="text-xs text-muted-foreground">Interest earned on cash savings — taxed yearly as savings income.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <Label htmlFor="include-ni" className="text-xs text-muted-foreground">Include National Insurance</Label>
          <Switch id="include-ni" checked={config.includeNI} onCheckedChange={(v) => update({ includeNI: v })} />
        </div>

        <Separator />

        {/* Person tabs */}
        <Tabs defaultValue="person1">
          <TabsList className="w-full">
            <TabsTrigger value="person1" className="flex-1 text-xs">{config.person1.name || "Partner 1"}</TabsTrigger>
            <TabsTrigger value="person2" className="flex-1 text-xs">{config.person2.name || "Partner 2"}</TabsTrigger>
          </TabsList>
          <TabsContent value="person1" className="mt-4">
            <PersonForm person={config.person1} label="p1" onChange={updatePerson1} />
          </TabsContent>
          <TabsContent value="person2" className="mt-4">
            <PersonForm person={config.person2} label="p2" onChange={updatePerson2} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
