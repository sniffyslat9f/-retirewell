"use client"

import React from "react"
import { useRef } from "react"
import type { HealthScore, HouseholdConfig, YearProjection } from "@/lib/types"
import { formatCurrency } from "@/lib/engine"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface PrintSummaryProps {
  config: HouseholdConfig
  score: HealthScore
  projection: YearProjection[]
}

export function PrintSummary({ config, score, projection }: PrintSummaryProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const totalPortfolio =
    config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments + config.person1.cashSavings +
    config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments + config.person2.cashSavings

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>RetireWell — ${config.person1.name} & ${config.person2.name} — ${today}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 9pt; color: #111; background: white;
      print-color-adjust: exact; -webkit-print-color-adjust: exact;
    }
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:4mm; margin-bottom:5mm; border-bottom:2px solid #111; }
    .header-left { display:flex; align-items:center; gap:8px; }
    .logo { width:32px; height:32px; background:#111; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .logo svg { width:18px; height:18px; }
    .brand-name { font-size:16pt; font-weight:700; letter-spacing:-0.5px; line-height:1; }
    .brand-sub { font-size:8pt; color:#666; margin-top:1px; }
    .header-right { text-align:right; font-size:8.5pt; color:#555; line-height:1.6; }
    .header-right strong { color:#111; font-size:9.5pt; display:block; }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:3mm; margin-bottom:5mm; }
    .kpi { border:1px solid #ddd; border-radius:5px; padding:3mm 3.5mm; }
    .kpi-label { font-size:7.5pt; color:#666; margin-bottom:1.5mm; }
    .kpi-value { font-size:13pt; font-weight:700; line-height:1; }
    .kpi-value.green { color:#16a34a; }
    .kpi-value.indigo { color:#4f46e5; }
    .section-title { font-size:10pt; font-weight:600; margin-bottom:2.5mm; margin-top:4mm; padding-bottom:1.5mm; border-bottom:1px solid #ddd; }
    .summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-bottom:4mm; }
    .summary-card { border:1px solid #ddd; border-radius:5px; padding:3mm 3.5mm; }
    .summary-card-title { font-size:8.5pt; font-weight:600; margin-bottom:2mm; color:#333; }
    .summary-row { display:flex; justify-content:space-between; font-size:8.5pt; padding:1mm 0; border-bottom:1px solid #f0f0f0; }
    .summary-row:last-child { border-bottom:none; }
    .summary-row-label { color:#666; }
    .summary-row-value { font-weight:500; }
    table { width:100%; border-collapse:collapse; font-size:7.8pt; table-layout:fixed; }
    col.cy  { width:8%; }
    col.ca  { width:8%; }
    col.cp  { width:13%; }
    col.cw  { width:11%; }
    col.cs  { width:11%; }
    col.co  { width:11%; }
    col.ci  { width:11%; }
    col.cg  { width:9%; }
    col.cn  { width:11%; }
    thead tr { background:#f5f5f5; }
    th { padding:2mm 2mm; font-weight:600; color:#444; border-top:1.5px solid #bbb; border-bottom:1.5px solid #bbb; text-align:right; white-space:nowrap; overflow:hidden; }
    th:first-child, th:nth-child(2) { text-align:left; }
    td { padding:1.6mm 2mm; text-align:right; border-bottom:1px solid #f0f0f0; overflow:hidden; }
    td:first-child { text-align:left; }
    td:nth-child(2) { text-align:left; white-space:nowrap; }
    td.neg { color:#dc2626; }
    td.dim { color:#bbb; }
    tr.ms td { background:#f8f8f8; color:#555; font-style:italic; font-size:7.5pt; padding:1mm 2mm; }
    .cont-page { page-break-before:always; padding-top:8mm; }
    .cont-header { display:flex; justify-content:space-between; align-items:center; padding-bottom:3mm; margin-bottom:4mm; border-bottom:2px solid #111; }
    .cont-brand { font-size:13pt; font-weight:700; }
    .cont-sub { font-size:7.5pt; color:#666; margin-top:1px; }
    .cont-right { text-align:right; font-size:8pt; color:#555; line-height:1.6; }
    .cont-right strong { color:#111; display:block; }
    .footer { margin-top:5mm; padding-top:3mm; border-top:1px solid #ddd; font-size:7pt; color:#aaa; text-align:center; }
  </style>
</head>
<body>${printContent.innerHTML}</body>
</html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const colGroup = (
    <colgroup>
      <col className="cy" /><col className="ca" /><col className="cp" />
      <col className="cw" /><col className="cs" /><col className="co" />
      <col className="ci" /><col className="cg" /><col className="cn" />
    </colgroup>
  )

  const thead = (
    <thead>
      <tr>
        <th style={{textAlign:"left"}}>Year</th>
        <th style={{textAlign:"left"}}>Ages</th>
        <th>Portfolio</th>
        <th>Withdrawals</th>
        <th>State Pension</th>
        <th>Other Income</th>
        <th>Income Tax</th>
        <th>CGT</th>
        <th>Net Income</th>
      </tr>
    </thead>
  )

  const dash = <span className="dim">—</span>

  const buildRows = (rows: YearProjection[]) => (
    <tbody>
      {rows.map((row) => (
        <React.Fragment key={row.year}>
          <tr>
            <td>{row.year}</td>
            <td>{row.age1}&thinsp;/&thinsp;{row.age2}</td>
            <td className={row.portfolioValue <= 0 ? "neg" : ""}>{formatCurrency(row.portfolioValue)}</td>
            <td>{formatCurrency(row.withdrawals)}</td>
            <td>{row.statePensionIncome === 0 ? dash : formatCurrency(row.statePensionIncome)}</td>
            <td>{row.otherIncome === 0 ? dash : formatCurrency(row.otherIncome)}</td>
            <td className={row.incomeTax > 0 ? "neg" : "dim"}>{row.incomeTax === 0 ? "—" : formatCurrency(row.incomeTax)}</td>
            <td className={row.cgt > 0 ? "neg" : "dim"}>{row.cgt === 0 ? "—" : formatCurrency(row.cgt)}</td>
            <td>{formatCurrency(row.netIncome)}</td>
          </tr>
          {row.milestone && (
            <tr className="ms">
              <td colSpan={9}>📍 {row.milestone}</td>
            </tr>
          )}
        </React.Fragment>
      ))}
    </tbody>
  )

  const totalYears = config.projectionYears ?? 40
  const FIRST = 14
  const allRows = projection.slice(0, totalYears)
  const page1Rows = allRows.slice(0, FIRST)
  const page2Rows = allRows.slice(FIRST)

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 text-xs">
          <Printer className="size-3.5" />
          Print Summary
        </Button>
        <span className="text-[10px] text-muted-foreground">Tip: disable headers &amp; footers in print dialog</span>
      </div>

      <div ref={printRef} style={{ display: "none" }}>
        <div className="page">

          {/* Page 1 header */}
          <div className="header">
            <div className="header-left">
              <div className="logo">
                <svg fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                </svg>
              </div>
              <div>
                <div className="brand-name">RetireWell</div>
                <div className="brand-sub">Retirement Health Dashboard</div>
              </div>
            </div>
            <div className="header-right">
              <strong>{config.person1.name} &amp; {config.person2.name}</strong>
              Ages {config.person1.age} &amp; {config.person2.age}<br />
              {today}
            </div>
          </div>

          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-label">Total Portfolio</div><div className="kpi-value green">{formatCurrency(totalPortfolio)}</div></div>
            <div className="kpi"><div className="kpi-label">Annual Spending</div><div className="kpi-value">{formatCurrency(config.annualSpending)}</div></div>
            <div className="kpi"><div className="kpi-label">Monte Carlo — Age 95</div><div className="kpi-value indigo">{score.survivalProbability95}%</div></div>
            <div className="kpi"><div className="kpi-label">Withdrawal Rate</div><div className="kpi-value">{score.actualRate.toFixed(1)}%</div></div>
          </div>

          {/* Household summary */}
          <div className="section-title">Household Summary</div>
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-card-title">{config.person1.name} (age {config.person1.age})</div>
              <div className="summary-row"><span className="summary-row-label">ISA</span><span className="summary-row-value">{formatCurrency(config.person1.isaBalance)}</span></div>
              <div className="summary-row"><span className="summary-row-label">SIPP</span><span className="summary-row-value">{formatCurrency(config.person1.sippBalance)}</span></div>
              <div className="summary-row"><span className="summary-row-label">GIA</span><span className="summary-row-value">{formatCurrency(config.person1.generalInvestments)}</span></div>
              <div className="summary-row"><span className="summary-row-label">Cash</span><span className="summary-row-value">{formatCurrency(config.person1.cashSavings)}</span></div>
              <div className="summary-row"><span className="summary-row-label">State Pension (age {config.person1.statePensionAge})</span><span className="summary-row-value">{formatCurrency(config.person1.statePensionAmount)}/yr</span></div>
              {config.person1.otherIncome.map((oi, i) => (
                <div key={i} className="summary-row"><span className="summary-row-label">{oi.label}</span><span className="summary-row-value">{formatCurrency(oi.annualAmount)}/yr</span></div>
              ))}
            </div>
            <div className="summary-card">
              <div className="summary-card-title">{config.person2.name} (age {config.person2.age})</div>
              <div className="summary-row"><span className="summary-row-label">ISA</span><span className="summary-row-value">{formatCurrency(config.person2.isaBalance)}</span></div>
              <div className="summary-row"><span className="summary-row-label">SIPP</span><span className="summary-row-value">{formatCurrency(config.person2.sippBalance)}</span></div>
              <div className="summary-row"><span className="summary-row-label">GIA</span><span className="summary-row-value">{formatCurrency(config.person2.generalInvestments)}</span></div>
              <div className="summary-row"><span className="summary-row-label">Cash</span><span className="summary-row-value">{formatCurrency(config.person2.cashSavings)}</span></div>
              <div className="summary-row"><span className="summary-row-label">State Pension (age {config.person2.statePensionAge})</span><span className="summary-row-value">{formatCurrency(config.person2.statePensionAmount)}/yr</span></div>
              {config.person2.otherIncome.map((oi, i) => (
                <div key={i} className="summary-row"><span className="summary-row-label">{oi.label}</span><span className="summary-row-value">{formatCurrency(oi.annualAmount)}/yr</span></div>
              ))}
            </div>
          </div>

          {/* Page 1 table */}
          <div className="section-title">Year-by-Year Projection — Today's £ (inflation-adjusted)</div>
          <table>{colGroup}{thead}{buildRows(page1Rows)}</table>

          {/* Page 2 */}
          {page2Rows.length > 0 && (
            <div className="cont-page">
              <div className="cont-header">
                <div>
                  <div className="cont-brand">RetireWell</div>
                  <div className="cont-sub">Retirement Health Dashboard — continued</div>
                </div>
                <div className="cont-right">
                  <strong>{config.person1.name} &amp; {config.person2.name}</strong>
                  Ages {config.person1.age} &amp; {config.person2.age} · {today}
                </div>
              </div>
              <table>{colGroup}{thead}{buildRows(page2Rows)}</table>
              <div className="footer">
                This document provides estimates only and does not constitute financial advice. Tax rules and rates may change. Consult a qualified financial adviser for personalised guidance.
              </div>
            </div>
          )}

          {page2Rows.length === 0 && (
            <div className="footer">
              This document provides estimates only and does not constitute financial advice. Tax rules and rates may change. Consult a qualified financial adviser for personalised guidance.
            </div>
          )}

        </div>
      </div>
    </>
  )
}
