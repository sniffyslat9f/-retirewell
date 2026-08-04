/* RetireWell engine test suite.
 * Checks the tax maths against known UK 2024/25 figures and verifies the Tier-1 accuracy features.
 * Run with:  npm test   (compiles the engine, then runs these checks)
 */
const E = require('../.test-build/engine.js')

let pass = 0, fail = 0
function eq(label, got, want, tol = 0.5) {
  const ok = Math.abs(got - want) <= tol
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${Math.round(got)}, want ${want})`)
  ok ? pass++ : fail++
}
function ok(label, cond) {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`)
  cond ? pass++ : fail++
}

console.log('\n# Income tax (England 2024/25)')
eq('£12,570 = personal allowance, no tax', E.calculateUKIncomeTax(12570, false), 0)
eq('£20,000', E.calculateUKIncomeTax(20000, false), 1486)
eq('£50,270 (top of basic rate)', E.calculateUKIncomeTax(50270, false), 7540)
eq('£60,000', E.calculateUKIncomeTax(60000, false), 11432)
eq('£100,000', E.calculateUKIncomeTax(100000, false), 27432)
eq('£125,140 (allowance fully tapered)', E.calculateUKIncomeTax(125140, false), 42516)
eq('£150,000 (additional rate)', E.calculateUKIncomeTax(150000, false), 53703)

console.log('\n# Capital gains tax (2024/25, shares 18%/24%, £3,000 allowance)')
eq('£6k gain, basic-rate taxpayer', E.calculateCGT(10000, 4000, 0, false), 540)      // (6000-3000)*18%
eq('£20k gain, basic-rate', E.calculateCGT(20000, 0, 0, false), 3060)                // (20000-3000)*18%
eq('£6k gain, higher-rate taxpayer', E.calculateCGT(10000, 4000, 60000, false), 720) // (6000-3000)*24%
eq('gain within allowance = no tax', E.calculateCGT(5000, 2500, 0, false), 0)

console.log('\n# Dividend tax (2024/25, £500 allowance, 8.75%/33.75%/39.35%)')
eq('£500 dividends within allowance', E.calculateDividendTax(500, 20000), 0)
eq('£1,000 dividends, basic-rate', E.calculateDividendTax(1000, 20000), 44)          // 500*8.75%
eq('£5,000 dividends, higher-rate', E.calculateDividendTax(5000, 60000), 1519)       // 4500*33.75%

console.log('\n# Savings interest tax (PSA £1,000 basic / £500 higher)')
eq('£1,000 interest within PSA (basic)', E.calculateSavingsTax(1000, 20000), 0)
eq('£2,000 interest, basic-rate', E.calculateSavingsTax(2000, 20000), 200)           // 1000*20%
eq('£2,000 interest, higher-rate', E.calculateSavingsTax(2000, 60000), 600)          // 1500*40%

console.log('\n# Pension tax-free lump sum cap (£268,275)')
const person = { taxFreeLumpSumTaken: false, receivingStatePension: false, statePensionAge: 99, statePensionAmount: 0, otherIncome: [], useScottishTax: false }
eq('25% tax-free when allowance available', E.calculatePersonTax(person, 60, 100000, 0, 0, Infinity).taxFreeUsed, 25000)
eq('tax-free capped at remaining allowance', E.calculatePersonTax(person, 60, 100000, 0, 0, 10000).taxFreeUsed, 10000)
eq('lump sum already taken = none tax-free', E.calculatePersonTax({ ...person, taxFreeLumpSumTaken: true }, 60, 100000, 0, 0, Infinity).taxFreeUsed, 0)

console.log('\n# Tier-1 features change results in the right direction')
const base = E.getDefaultConfig()
const proj = (over) => E.generateProjection({ ...base, ...over }, undefined, base.inflationRate)
const endVal = (p) => p[p.length - 1].portfolioValue
ok('higher charges -> smaller pot', endVal(proj({ annualCharges: 0.01 })) < endVal(proj({ annualCharges: 0 })))
ok('dividends taxed -> smaller pot', endVal(proj({ dividendYield: 0.05 })) < endVal(proj({ dividendYield: 0 })))
const noTax = proj({ dividendYield: 0, cashInterestRate: 0, annualCharges: 0 })
ok('no NaN / valid numbers in projection', noTax.every(r => Number.isFinite(r.portfolioValue) && Number.isFinite(r.taxPaid)))

console.log('\n# Tier-2 risk modelling')
eq('100% stocks volatility = stock vol (17%)', E.portfolioVolatility(100), 0.17, 0.001)
eq('100% bonds volatility = bond vol (7%)', E.portfolioVolatility(0), 0.07, 0.001)
ok('60/40 mix is LESS volatile than a straight blend (diversification)',
  E.portfolioVolatility(60) < 0.6 * 0.17 + 0.4 * 0.07)
// Fat-tailed draws: over many samples the mean ~0 and variance ~1 (loose tolerance)
let n = 200000, sum = 0, sumSq = 0
for (let i = 0; i < n; i++) { const x = E.fatTailedDraw(); sum += x; sumSq += x * x }
const mean = sum / n, varc = sumSq / n - mean * mean
ok('fat-tailed draw mean ≈ 0', Math.abs(mean) < 0.05)
ok('fat-tailed draw variance ≈ 1', Math.abs(varc - 1) < 0.15)

console.log('\n# Tier-3 survival-to-100 honesty')
const young = { ...base, person1: { ...base.person1, age: 55 }, person2: { ...base.person2, age: 55 }, projectionYears: 40 }
// 40-year projection from age 55 reaches age 95, not 100 -> "to 100" must read N/A (-1), not a misleading 0
ok('survival-to-100 is N/A when projection too short (not a false 0)', E.calculateHealthScore(young).survivalProbability100 === -1)

console.log('\n# New defaults reflect Vanguard VUSA figures')
ok('default charges = 0.10%', Math.abs(base.annualCharges - 0.001) < 1e-9)
ok('default dividend yield = 1.25%', Math.abs(base.dividendYield - 0.0125) < 1e-9)

console.log('\n# Care cost & extra spending apply for EVERY withdrawal method')
const careScen = { ...E.getDefaultScenario(), careCostEnabled: true, careCostAge: 85, annualCareCost: 50000 }
function spendAt85(method, scen) {
  const cfg = { ...base, withdrawalConfig: { ...base.withdrawalConfig, method } }
  const p = E.generateProjection(cfg, undefined, cfg.inflationRate, scen)
  const row = p.find(r => Math.max(r.age1, r.age2) >= 85 && r.portfolioValue > 0)
  return row ? row.spending : 0
}
for (const m of ['constant', 'percent', 'vanguard_dynamic', 'guyton_klinger']) {
  ok(`care cost raises spending for "${m}" method`, spendAt85(m, careScen) > spendAt85(m, undefined) + 40000)
}
const extraScen = { ...E.getDefaultScenario(), extraSpending: 10000 }
const pctCfg = { ...base, withdrawalConfig: { ...base.withdrawalConfig, method: 'percent' } }
const yr1Extra = E.generateProjection(pctCfg, undefined, pctCfg.inflationRate, extraScen)[0].spending
const yr1Base = E.generateProjection(pctCfg, undefined, pctCfg.inflationRate, undefined)[0].spending
ok('extra spending applies to "% of portfolio" method (year 1 ≈ +£10k)', Math.abs((yr1Extra - yr1Base) - 10000) < 200)

console.log('\n# Combined scenarios (catch bugs that only show up when rules interact)')

// Scenario 1: SIPP withdrawal + a GIA gain in the same year, both within the basic-rate band.
// Hand-calc: pension £30,000 -> 25% tax-free (£7,500) -> taxable £22,500 -> tax £1,986 (20% on £9,930 above PA).
// GIA gain £6,000 (sold £20,000, cost basis £14,000) -> £3,000 above the £3,000 allowance -> all in
// basic band (taxable income £22,500 is well under £50,270) -> CGT £540 (18%).
{
  const p = { taxFreeLumpSumTaken: false, receivingStatePension: false, statePensionAge: 99, statePensionAmount: 0, otherIncome: [], useScottishTax: false }
  const r = E.calculatePersonTax(p, 60, 30000, 20000, 14000, Infinity)
  eq('combined: SIPP £30k + GIA gain £6k -> income tax', r.incomeTax, 1986)
  eq('combined: SIPP £30k + GIA gain £6k -> CGT', r.cgt, 540)
  eq('combined: SIPP £30k + GIA gain £6k -> taxable income', r.taxableIncome, 22500)
}

// Scenario 2: SIPP + state pension push taxable income close to the £50,270 CGT basic/higher
// boundary, then a GIA gain straddles that boundary. This is the case most likely to hide a bug —
// CGT's rate depends on *combined* taxable income, not the GIA gain alone.
// Hand-calc: pension £45,000 -> 25% tax-free £11,250 -> taxable £33,750. State pension £11,500
// (fully inside the personal allowance, £0 tax on its own). Combined taxable income £45,250 -> tax £6,536.
// GIA gain £10,000 (sold £15,000, cost £5,000) -> £7,000 taxable after allowance -> only £5,020 fits
// in the basic band before hitting £50,270 -> £5,020 @ 18% + £1,980 @ 24% = £1,379.
{
  const p = { taxFreeLumpSumTaken: false, receivingStatePension: true, statePensionAge: 66, statePensionAmount: 11500, otherIncome: [], useScottishTax: false }
  const r = E.calculatePersonTax(p, 66, 45000, 15000, 5000, Infinity)
  eq('combined: SIPP+state pension £45.25k taxable -> income tax', r.incomeTax, 6536)
  eq('combined: GIA gain straddles the £50,270 CGT band boundary -> CGT', r.cgt, 1379, 1)
}

// Scenario 3: CGT bands are reserved to Westminster, NOT devolved — a Scottish taxpayer's capital
// gains are still taxed against the UK £50,270 threshold, not the Scottish income tax bands (whose
// intermediate/higher boundary sits at £43,662). calculateCGT's `scottish` flag is intentionally
// unused for this reason — this test pins that down so it can't be "fixed" into a real bug later.
{
  const cgtScottish = E.calculateCGT(30000, 10000, 40000, true)
  const cgtRUK = E.calculateCGT(30000, 10000, 40000, false)
  eq('combined: Scottish taxpayer CGT uses the UK £50,270 threshold', cgtScottish, 3464)
  ok('combined: CGT is identical for Scottish vs rUK taxpayer at the same taxable income', cgtScottish === cgtRUK)
}

// Scenario 4: dividends stacking on top of pension + state pension income that's already most of
// the way through the basic-rate band (using scenario 2's £45,250 taxable income as the base).
// Hand-calc: £5,000 dividends -> £500 allowance -> £4,500 taxable, starting at £45,750 (income + allowance).
// Only £4,520 of basic-rate room left before £50,270 -> all £4,500 fits at 8.75% -> £394.
{
  const div = E.calculateDividendTax(5000, 45250)
  eq('combined: dividends stacking on near-exhausted basic band -> dividend tax', div, 394)
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`)
process.exit(fail === 0 ? 0 : 1)
