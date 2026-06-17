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

console.log(`\n==== ${pass} passed, ${fail} failed ====`)
process.exit(fail === 0 ? 0 : 1)
