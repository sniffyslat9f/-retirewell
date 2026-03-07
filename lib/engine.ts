import type { PersonConfig, HouseholdConfig, YearProjection, HealthScore, MonteCarloResult, ScenarioConfig, AccountType, WithdrawalConfig } from "./types"

// UK 2024/25 tax bands (England/Wales/NI)
const UK_PERSONAL_ALLOWANCE = 12570
const UK_BASIC_RATE_LIMIT = 50270
const UK_HIGHER_RATE_LIMIT = 125140

// Scottish tax bands 2024/25
const SCOT_STARTER_LIMIT = 14876
const SCOT_BASIC_LIMIT = 26561
const SCOT_INTERMEDIATE_LIMIT = 43662
const SCOT_HIGHER_LIMIT = 75000
const SCOT_ADVANCED_LIMIT = 125140

function calculateUKIncomeTax(taxableIncome: number, scottish: boolean): number {
  if (taxableIncome <= 0) return 0

  // Personal allowance taper above £100,000
  let personalAllowance = UK_PERSONAL_ALLOWANCE
  if (taxableIncome > 100000) {
    personalAllowance = Math.max(0, UK_PERSONAL_ALLOWANCE - (taxableIncome - 100000) / 2)
  }

  const taxable = Math.max(0, taxableIncome - personalAllowance)

  if (scottish) {
    return calculateScottishTax(taxable)
  }

  let tax = 0
  const basicLimit = UK_BASIC_RATE_LIMIT - personalAllowance
  const higherLimit = UK_HIGHER_RATE_LIMIT - personalAllowance

  if (taxable <= basicLimit) {
    tax = taxable * 0.20
  } else if (taxable <= higherLimit) {
    tax = basicLimit * 0.20 + (taxable - basicLimit) * 0.40
  } else {
    tax = basicLimit * 0.20 + (higherLimit - basicLimit) * 0.40 + (taxable - higherLimit) * 0.45
  }

  return Math.round(tax * 100) / 100
}

function calculateScottishTax(taxable: number): number {
  let tax = 0
  const bands = [
    { limit: SCOT_STARTER_LIMIT - UK_PERSONAL_ALLOWANCE, rate: 0.19 },
    { limit: SCOT_BASIC_LIMIT - UK_PERSONAL_ALLOWANCE, rate: 0.20 },
    { limit: SCOT_INTERMEDIATE_LIMIT - UK_PERSONAL_ALLOWANCE, rate: 0.21 },
    { limit: SCOT_HIGHER_LIMIT - UK_PERSONAL_ALLOWANCE, rate: 0.42 },
    { limit: SCOT_ADVANCED_LIMIT - UK_PERSONAL_ALLOWANCE, rate: 0.45 },
    { limit: Infinity, rate: 0.48 },
  ]

  let remaining = taxable
  let prevLimit = 0
  for (const band of bands) {
    const bandWidth = band.limit - prevLimit
    if (remaining <= 0) break
    const taxableInBand = Math.min(remaining, bandWidth)
    tax += taxableInBand * band.rate
    remaining -= taxableInBand
    prevLimit = band.limit
  }

  return Math.round(tax * 100) / 100
}

// UK CGT constants (post October 2024 Budget)
const CGT_ANNUAL_ALLOWANCE = 3000
const CGT_BASIC_RATE = 0.18
const CGT_HIGHER_RATE = 0.24
const UK_BASIC_RATE_THRESHOLD = 50270  // income above this = higher rate CGT

function calculateCGT(
  giaWithdrawal: number,
  giaCostBasisWithdrawn: number,
  taxableIncome: number,
  scottish: boolean,
  allowanceAlreadyUsed: number = 0,  // gains already counted against the annual allowance this year
): number {
  const gain = Math.max(0, giaWithdrawal - giaCostBasisWithdrawn)
  const remainingAllowance = Math.max(0, CGT_ANNUAL_ALLOWANCE - allowanceAlreadyUsed)
  const taxableGain = Math.max(0, gain - remainingAllowance)
  if (taxableGain <= 0) return 0

  const remainingBasicBand = Math.max(0, UK_BASIC_RATE_THRESHOLD - taxableIncome)
  const gainInBasicBand = Math.min(taxableGain, remainingBasicBand)
  const gainInHigherBand = taxableGain - gainInBasicBand

  return Math.round(gainInBasicBand * CGT_BASIC_RATE + gainInHigherBand * CGT_HIGHER_RATE)
}

// Reverse solver: find gross GIA sale needed to net a target amount after CGT
// Binary search — same approach as standalone HTML CGT calculator
function solveGrossForNet(
  targetNet: number,
  giaBalance: number,
  giaCostBasis: number,
  taxableIncome: number,
  scottish: boolean,
  allowanceAlreadyUsed: number = 0,
): { gross: number; cgt: number; costBasisWithdrawn: number } {
  if (targetNet <= 0) return { gross: 0, cgt: 0, costBasisWithdrawn: 0 }
  if (giaBalance <= 0) return { gross: 0, cgt: 0, costBasisWithdrawn: 0 }

  const costRatio = Math.min(1, giaCostBasis / giaBalance)

  // If no gain (cost basis >= value), no CGT — gross = net
  if (costRatio >= 1) {
    const gross = Math.min(targetNet, giaBalance)
    return { gross, cgt: 0, costBasisWithdrawn: gross }
  }

  // Binary search for gross sale that nets the target after CGT
  let lo = targetNet
  let hi = Math.min(targetNet * 1.5, giaBalance)
  let gross = targetNet

  for (let i = 0; i < 80; i++) {
    const mid = Math.min((lo + hi) / 2, giaBalance)
    const costOfSale = mid * costRatio
    const cgt = calculateCGT(mid, costOfSale, taxableIncome, scottish, allowanceAlreadyUsed)
    const netResult = mid - cgt
    if (Math.abs(netResult - targetNet) < 0.5) { gross = mid; break }
    if (netResult < targetNet) lo = mid
    else hi = mid
    gross = mid
  }

  gross = Math.min(gross, giaBalance)
  const costBasisWithdrawn = gross * costRatio
  const cgt = calculateCGT(gross, costBasisWithdrawn, taxableIncome, scottish, allowanceAlreadyUsed)
  return { gross, cgt: Math.round(cgt), costBasisWithdrawn }
}

// UK property income allowance
const PROPERTY_ALLOWANCE = 1000

function calculatePersonTax(
  person: PersonConfig,
  age: number,
  pensionWithdrawal: number,
  giaWithdrawal: number,
  giaCostBasisWithdrawn: number,
): { incomeTax: number; cgt: number; total: number; portfolioTax: number } {
  let taxableIncome = 0

  // SIPP/pension withdrawals — taxed as income
  if (!person.taxFreeLumpSumTaken) {
    taxableIncome += pensionWithdrawal * 0.75
  } else {
    taxableIncome += pensionWithdrawal
  }

  // State pension — taxable income
  const statePensionIncome = (person.receivingStatePension || age >= person.statePensionAge)
    ? person.statePensionAmount : 0
  taxableIncome += statePensionIncome

  // Other income
  let otherTaxableIncome = 0
  for (const income of person.otherIncome) {
    if (income.type === "rental") {
      otherTaxableIncome += Math.max(0, income.annualAmount - PROPERTY_ALLOWANCE)
    } else {
      otherTaxableIncome += income.annualAmount
    }
  }
  taxableIncome += otherTaxableIncome

  const totalIncomeTax = calculateUKIncomeTax(taxableIncome, person.useScottishTax)

  // Work out how much income tax is attributable to non-portfolio income
  // (state pension + other income) — this is paid from that income, not the portfolio
  const nonPortfolioIncome = statePensionIncome + otherTaxableIncome
  const nonPortfolioTax = calculateUKIncomeTax(nonPortfolioIncome, person.useScottishTax)

  // Only the incremental income tax caused by portfolio withdrawals needs to come from portfolio
  const portfolioIncomeTax = Math.max(0, totalIncomeTax - nonPortfolioTax)

  // CGT always comes from portfolio (it's on investment gains)
  const cgt = calculateCGT(giaWithdrawal, giaCostBasisWithdrawn, taxableIncome, person.useScottishTax)

  return {
    incomeTax: totalIncomeTax,
    cgt,
    total: totalIncomeTax + cgt,
    portfolioTax: portfolioIncomeTax + cgt,
    taxableIncome,
  }
}

// Returns blended growth rate based on stock/bond allocation
//
// Stock return: 10.0% nominal based on S&P 500 long-run historical average (1926–present,
// Ibbotson/Morningstar data). This is the figure used by most serious FIRE calculators
// including cFIREsim and FICalc. Volatility (std dev) ~17% matches historical S&P 500.
//
// Bond return: 4.5% nominal based on long-run US 10-year treasury average.
// Volatility ~7% reflects typical intermediate bond fund behaviour.
//
// Note: inflation is subtracted separately in the projection engine so that
// all output figures can be shown in real (today's) terms.
const STOCK_RETURN = 0.10   // default nominal
const BOND_RETURN = 0.045   // default nominal
const STOCK_VOLATILITY = 0.17
const BOND_VOLATILITY = 0.07

function blendedReturn(stocksPct: number, stocksReturn = STOCK_RETURN, bondsReturn = BOND_RETURN): number {
  const s = stocksPct / 100
  return s * stocksReturn + (1 - s) * bondsReturn
}

function blendedVolatility(stocksPct: number): number {
  const s = stocksPct / 100
  return s * STOCK_VOLATILITY + (1 - s) * BOND_VOLATILITY
}

// Withdrawal method: calculates target spending for this year
function calculateTargetSpending(
  wc: WithdrawalConfig,
  baseSpending: number,
  portfolioValue: number,
  initialPortfolio: number,
  initialWithdrawalRate: number,
  prevSpending: number,
): number {
  switch (wc.method) {
    case "constant":
      return baseSpending

    case "percent":
      return portfolioValue * (wc.percentOfPortfolio / 100)

    case "vanguard_dynamic": {
      // Target = % of current portfolio, but constrained by floor/ceiling vs prior year
      const target = portfolioValue * (wc.percentOfPortfolio / 100)
      const floor = prevSpending * (1 - wc.floorPct / 100)
      const ceiling = prevSpending * (1 + wc.ceilingPct / 100)
      return Math.max(floor, Math.min(ceiling, target))
    }

    case "guyton_klinger": {
      // Start with prior spending, apply guardrail adjustments
      let spending = prevSpending
      if (portfolioValue > 0) {
        const currentRate = spending / portfolioValue
        const upperGuardrail = initialWithdrawalRate * (1 + wc.guardrailUpper / 100)
        const lowerGuardrail = initialWithdrawalRate * (1 - wc.guardrailLower / 100)
        if (currentRate > upperGuardrail) spending *= 0.90  // cut 10%
        if (currentRate < lowerGuardrail) spending *= 1.10  // raise 10%
      }
      return spending
    }

    default:
      return baseSpending
  }
}

function getPersonTotalIncome(person: PersonConfig): number {
  let income = 0
  if (person.receivingStatePension || person.age >= person.statePensionAge) {
    income += person.statePensionAmount
  }
  for (const oi of person.otherIncome) {
    income += oi.annualAmount
  }
  return income
}

function withdrawFromAccounts(
  balances: { cash: number; isa: number; sipp: number; general: number },
  amount: number,
  order: AccountType[]
): { cash: number; isa: number; sipp: number; general: number; pensionWithdrawn: number; giaWithdrawn: number } {
  let remaining = amount
  let pensionWithdrawn = 0
  let giaWithdrawn = 0
  const newBalances = { ...balances }

  for (const account of order) {
    if (remaining <= 0) break
    const available = newBalances[account]
    const withdrawal = Math.min(available, remaining)
    newBalances[account] -= withdrawal
    remaining -= withdrawal
    if (account === "sipp") {
      pensionWithdrawn += withdrawal
    }
    if (account === "general") {
      giaWithdrawn += withdrawal
    }
  }

  return { ...newBalances, pensionWithdrawn, giaWithdrawn }
}

export function generateProjection(
  config: HouseholdConfig,
  growthRate: number = 0.05,
  inflationRate: number = config.inflationRate ?? 0.025,
  scenario?: ScenarioConfig,
  yearlyRealReturns?: number[]  // optional per-year real returns override (historical sequence)
): YearProjection[] {
  const projections: YearProjection[] = []
  const maxYears = config.projectionYears ?? 40

  const stocksReturn = config.stocksReturn ?? STOCK_RETURN
  const bondsReturn = config.bondsReturn ?? BOND_RETURN
  const tripleLock = config.tripleLockStatePension ?? false
  const wc = config.withdrawalConfig ?? { method: "constant", percentOfPortfolio: 4, floorPct: 2.5, ceilingPct: 5, guardrailLower: 20, guardrailUpper: 20 }

  let p1Balances = {
    cash: config.person1.cashSavings,
    isa: config.person1.isaBalance,
    sipp: config.person1.sippBalance,
    general: config.person1.generalInvestments,
  }
  let p2Balances = {
    cash: config.person2.cashSavings,
    isa: config.person2.isaBalance,
    sipp: config.person2.sippBalance,
    general: config.person2.generalInvestments,
  }

  let p1GiaCostBasis = Math.min(config.person1.giaCostBasis, config.person1.generalInvestments)
  let p2GiaCostBasis = Math.min(config.person2.giaCostBasis, config.person2.generalInvestments)

  let annualSpending = config.annualSpending
  if (scenario?.extraSpending) annualSpending += scenario.extraSpending

  if (scenario?.marketCrash) {
    const crashFactor = 1 - (scenario.marketCrashPercent / 100)
    p1Balances.isa *= crashFactor; p1Balances.sipp *= crashFactor; p1Balances.general *= crashFactor
    p2Balances.isa *= crashFactor; p2Balances.sipp *= crashFactor; p2Balances.general *= crashFactor
  }

  const initialPortfolio =
    p1Balances.cash + p1Balances.isa + p1Balances.sipp + p1Balances.general +
    p2Balances.cash + p2Balances.isa + p2Balances.sipp + p2Balances.general

  // For triple lock: state pension grows at max(inflation, earnings growth 2%, 2.5%)
  // Approximated as max(inflation, 0.025) above inflation — i.e. always at least 2.5% real
  let p1StatePensionReal = config.person1.statePensionAmount
  let p2StatePensionReal = config.person2.statePensionAmount

  let prevSpending = annualSpending
  let initialWithdrawalRate = initialPortfolio > 0 ? annualSpending / initialPortfolio : 0.04

  // Track previous year GIA balances for milestone detection
  let prevP1Gia = config.person1.generalInvestments
  let prevP2Gia = config.person2.generalInvestments
  let prevP1Sp = 0, prevP2Sp = 0

  for (let year = 0; year < maxYears; year++) {
    const age1 = config.person1.age + year
    const age2 = config.person2.age + year

    const totalPortfolio =
      p1Balances.cash + p1Balances.isa + p1Balances.sipp + p1Balances.general +
      p2Balances.cash + p2Balances.isa + p2Balances.sipp + p2Balances.general

    if (totalPortfolio <= 0 && year > 0) {
      projections.push({
        year: new Date().getFullYear() + year,
        age1, age2,
        portfolioValue: 0, withdrawals: 0,
        taxPaid: 0, incomeTax: 0, cgt: 0, bedAndIsaCgt: 0,
        statePensionIncome: 0, otherIncome: 0,
        netIncome: 0, spending: 0,
        isaBalance: 0, sippBalance: 0, generalBalance: 0, cashBalance: 0,
      })
      continue
    }

    // Triple lock: state pension grows at max(inflation, 2.5%) in real terms
    // i.e. if inflation < 2.5%, state pension gets a small real-terms boost
    if (tripleLock && year > 0) {
      const tripleGrowth = Math.max(0, 0.025 - inflationRate)  // real uplift above inflation
      p1StatePensionReal *= (1 + tripleGrowth)
      p2StatePensionReal *= (1 + tripleGrowth)
    }

    const p1StatePension = (config.person1.receivingStatePension || age1 >= config.person1.statePensionAge)
      ? p1StatePensionReal : 0
    const p2StatePension = (config.person2.receivingStatePension || age2 >= config.person2.statePensionAge)
      ? p2StatePensionReal : 0

    let statePensionTotal = p1StatePension + p2StatePension
    if (scenario?.delayStatePension && scenario.delayYears > 0) {
      const delayedAge1 = config.person1.statePensionAge + scenario.delayYears
      const delayedAge2 = config.person2.statePensionAge + scenario.delayYears
      statePensionTotal = (age1 >= delayedAge1 ? p1StatePensionReal : 0)
        + (age2 >= delayedAge2 ? p2StatePensionReal : 0)
    }

    const p1Other = getPersonTotalIncome({ ...config.person1, age: age1, statePensionAmount: 0, receivingStatePension: false, otherIncome: config.person1.otherIncome })
    const p2Other = getPersonTotalIncome({ ...config.person2, age: age2, statePensionAmount: 0, receivingStatePension: false, otherIncome: config.person2.otherIncome })
    const totalOtherIncome = p1Other + p2Other

    let careCost = 0
    if (scenario?.careCostEnabled && scenario.careCostAge > 0) {
      if (age1 >= scenario.careCostAge || age2 >= scenario.careCostAge) {
        careCost = scenario.annualCareCost
      }
    }

    // Spending phases — override flat spending if configured
    let baseSpending = annualSpending
    if (config.spendingPhases && config.spendingPhases.length > 0) {
      const olderAge = Math.max(age1, age2)
      const phase = config.spendingPhases.find(p => olderAge <= p.untilAge)
      if (phase) baseSpending = phase.annualAmount
      else baseSpending = config.spendingPhases[config.spendingPhases.length - 1].annualAmount
    }

    if (scenario?.reduceSpending) {
      const startAge = scenario.reduceSpendingFromAge ?? 0
      const endAge = startAge + (scenario.reduceSpendingForYears ?? 0)
      const olderAge = Math.max(age1, age2)
      if (olderAge >= startAge && olderAge < endAge) {
        baseSpending = scenario.reducedSpendingAmount ?? baseSpending
      }
    }

    // Apply withdrawal method to determine target spending this year
    const targetSpending = calculateTargetSpending(wc, baseSpending + careCost, totalPortfolio, initialPortfolio, initialWithdrawalRate, prevSpending + careCost)
    prevSpending = targetSpending - careCost

    // targetSpending is NET — what the household actually receives after all tax
    // Income sources (state pension, DB pension) are GROSS — we must deduct tax on them
    // to find how much net income they actually contribute toward the spending target

    // Calculate income tax on non-portfolio income per person
    const p1NonPortfolioIncome = (config.person1.receivingStatePension || age1 >= config.person1.statePensionAge
      ? p1StatePensionReal : 0) + p1Other
    const p2NonPortfolioIncome = (config.person2.receivingStatePension || age2 >= config.person2.statePensionAge
      ? p2StatePensionReal : 0) + p2Other
    const p1NonPortfolioTax = calculateUKIncomeTax(p1NonPortfolioIncome, config.person1.useScottishTax)
    const p2NonPortfolioTax = calculateUKIncomeTax(p2NonPortfolioIncome, config.person2.useScottishTax)

    // Net income from sources after tax
    const incomeFromSources = statePensionTotal + totalOtherIncome
    const netIncomeFromSources = Math.max(0, incomeFromSources - p1NonPortfolioTax - p2NonPortfolioTax)

    // Net amount still needed from portfolio after net income from sources
    const netPortfolioNeeded = Math.max(0, targetSpending - netIncomeFromSources)

    // Split portfolio need proportionally between partners by portfolio size
    const p1PortfolioTotal = p1Balances.cash + p1Balances.isa + p1Balances.sipp + p1Balances.general
    const p2PortfolioTotal = p2Balances.cash + p2Balances.isa + p2Balances.sipp + p2Balances.general
    const totalPortfolioForSplit = Math.max(1, p1PortfolioTotal + p2PortfolioTotal)
    const p1Share = p1PortfolioTotal / totalPortfolioForSplit
    const p2Share = 1 - p1Share

    const p1NetNeeded = netPortfolioNeeded * p1Share
    const p2NetNeeded = netPortfolioNeeded * p2Share

    // Gross up withdrawals so that net spending target is met after ALL taxes
    // (income tax on SIPP + CGT on GIA). Iterate to convergence.
    let p1GrossNeeded = p1NetNeeded
    let p2GrossNeeded = p2NetNeeded
    let p1Result = withdrawFromAccounts(p1Balances, 0, config.person1.drawdownOrder)
    let p2Result = withdrawFromAccounts(p2Balances, 0, config.person2.drawdownOrder)
    let p1TaxResult = { incomeTax: 0, cgt: 0, total: 0, portfolioTax: 0, taxableIncome: 0 }
    let p2TaxResult = { incomeTax: 0, cgt: 0, total: 0, portfolioTax: 0, taxableIncome: 0 }
    let p1CostBasisWithdrawn = 0
    let p2CostBasisWithdrawn = 0

    for (let iter = 0; iter < 12; iter++) {
      p1Result = withdrawFromAccounts(p1Balances, p1GrossNeeded, config.person1.drawdownOrder)
      p2Result = withdrawFromAccounts(p2Balances, p2GrossNeeded, config.person2.drawdownOrder)

      const p1CostBasisRatio = p1Balances.general > 0 ? Math.min(1, p1GiaCostBasis / p1Balances.general) : 0
      p1CostBasisWithdrawn = p1Result.giaWithdrawn * p1CostBasisRatio
      const p2CostBasisRatio = p2Balances.general > 0 ? Math.min(1, p2GiaCostBasis / p2Balances.general) : 0
      p2CostBasisWithdrawn = p2Result.giaWithdrawn * p2CostBasisRatio

      p1TaxResult = calculatePersonTax({ ...config.person1, age: age1 }, age1, p1Result.pensionWithdrawn, p1Result.giaWithdrawn, p1CostBasisWithdrawn)
      p2TaxResult = calculatePersonTax({ ...config.person2, age: age2 }, age2, p2Result.pensionWithdrawn, p2Result.giaWithdrawn, p2CostBasisWithdrawn)

      // Gross up for ALL portfolio taxes: income tax on SIPP + CGT on GIA
      // portfolioTax = income tax attributable to portfolio + CGT on GIA withdrawals
      const p1NewGross = p1NetNeeded + p1TaxResult.portfolioTax
      const p2NewGross = p2NetNeeded + p2TaxResult.portfolioTax

      if (Math.abs(p1NewGross - p1GrossNeeded) < 1 && Math.abs(p2NewGross - p2GrossNeeded) < 1) break
      p1GrossNeeded = p1NewGross
      p2GrossNeeded = p2NewGross
    }

    // Recalculate final cost basis withdrawn after convergence
    const p1CostBasisRatioFinal = p1Balances.general > 0 ? Math.min(1, p1GiaCostBasis / p1Balances.general) : 0
    p1CostBasisWithdrawn = p1Result.giaWithdrawn * p1CostBasisRatioFinal
    const p2CostBasisRatioFinal = p2Balances.general > 0 ? Math.min(1, p2GiaCostBasis / p2Balances.general) : 0
    p2CostBasisWithdrawn = p2Result.giaWithdrawn * p2CostBasisRatioFinal

    p1TaxResult = calculatePersonTax({ ...config.person1, age: age1 }, age1, p1Result.pensionWithdrawn, p1Result.giaWithdrawn, p1CostBasisWithdrawn)
    p2TaxResult = calculatePersonTax({ ...config.person2, age: age2 }, age2, p2Result.pensionWithdrawn, p2Result.giaWithdrawn, p2CostBasisWithdrawn)

    const portfolioNeeded = p1GrossNeeded + p2GrossNeeded

    // Update cost basis after final withdrawal amounts settled
    p1GiaCostBasis = Math.max(0, p1GiaCostBasis - p1CostBasisWithdrawn)
    p2GiaCostBasis = Math.max(0, p2GiaCostBasis - p2CostBasisWithdrawn)

    const totalTax = p1TaxResult.total + p2TaxResult.total

    // Bed & ISA transfers — sell GIA, buy same assets in ISA wrapper
    // Crystallises CGT but shelters future growth from tax
    // ISA allowance: £20k per person per tax year
    const ISA_ANNUAL_ALLOWANCE = 20000

    let p1BedIsaCgt = 0
    let p2BedIsaCgt = 0
    let p1BedIsaAmount = 0
    let p2BedIsaAmount = 0

    const applyBedAndIsa = (
      bi: typeof config.person1.bedAndIsa,
      age: number,
      giaBalance: number,
      giaCostBasis: number,
      taxableIncome: number,
      scottish: boolean,
      gainAlreadyRealised: number,
    ): { transfer: number; grossSold: number; cgt: number; newGiaBasis: number } => {
      if (!bi.enabled) return { transfer: 0, grossSold: 0, cgt: 0, newGiaBasis: giaCostBasis }
      if (age < bi.startAge) return { transfer: 0, grossSold: 0, cgt: 0, newGiaBasis: giaCostBasis }
      // If not untilExhausted, respect the years limit
      if (!bi.untilExhausted && age >= bi.startAge + bi.years) return { transfer: 0, grossSold: 0, cgt: 0, newGiaBasis: giaCostBasis }

      // Target net into ISA = min(annualAmount, ISA_ANNUAL_ALLOWANCE)
      // Use reverse solver: find gross GIA sale that nets this amount after CGT
      const targetNet = Math.min(bi.annualAmount, ISA_ANNUAL_ALLOWANCE)
      const { gross, cgt, costBasisWithdrawn } = solveGrossForNet(
        targetNet, giaBalance, giaCostBasis, taxableIncome, scottish, gainAlreadyRealised
      )
      if (gross <= 0) return { transfer: 0, grossSold: 0, cgt: 0, newGiaBasis: giaCostBasis }

      const newGiaBasis = Math.max(0, giaCostBasis - costBasisWithdrawn)
      // transfer = net amount into ISA = gross - cgt
      const transfer = Math.min(gross - cgt, giaBalance)

      return { transfer, grossSold: gross, cgt, newGiaBasis }
    }

    // Gains already realised through regular GIA withdrawals this year (per person)
    const p1GainFromWithdrawal = Math.max(0, p1Result.giaWithdrawn - p1CostBasisWithdrawn)
    const p2GainFromWithdrawal = Math.max(0, p2Result.giaWithdrawn - p2CostBasisWithdrawn)

    const p1BiResult = applyBedAndIsa(
      config.person1.bedAndIsa,
      age1,
      p1Result.general,
      p1GiaCostBasis,
      p1TaxResult.taxableIncome ?? 0,
      config.person1.useScottishTax,
      p1GainFromWithdrawal,
    )
    p1BedIsaAmount = p1BiResult.transfer
    p1BedIsaCgt = p1BiResult.cgt
    p1GiaCostBasis = p1BiResult.newGiaBasis

    const p2BiResult = applyBedAndIsa(
      config.person2.bedAndIsa,
      age2,
      p2Result.general,
      p2GiaCostBasis,
      p2TaxResult.taxableIncome ?? 0,
      config.person2.useScottishTax,
      p2GainFromWithdrawal,
    )
    p2BedIsaAmount = p2BiResult.transfer
    p2BedIsaCgt = p2BiResult.cgt
    p2GiaCostBasis = p2BiResult.newGiaBasis

    // Apply transfers: GIA deducted by gross sold, ISA credited by net transfer (after CGT)
    const p1GeneralAfterBi = p1Result.general - p1BiResult.grossSold
    const p1IsaAfterBi = p1Result.isa + p1BedIsaAmount
    const p2GeneralAfterBi = p2Result.general - p2BiResult.grossSold
    const p2IsaAfterBi = p2Result.isa + p2BedIsaAmount

    // Growth on remaining balances using per-account stock/bond allocation
    // If yearlyRealReturns provided (historical sequence), use that year's actual real return for all accounts
    const historicalReal = yearlyRealReturns?.[year]
    const useHistorical = historicalReal !== undefined

    const growthFactor = (stocksPct: number) =>
      useHistorical
        ? 1 + historicalReal
        : 1 + blendedReturn(stocksPct, stocksReturn, bondsReturn) - inflationRate

    const p1GiaGrowth = growthFactor(config.person1.generalAllocation.stocksPct)
    const p2GiaGrowth = growthFactor(config.person2.generalAllocation.stocksPct)

    p1Balances = {
      cash: p1Result.cash,
      isa: p1IsaAfterBi * growthFactor(config.person1.isaAllocation.stocksPct),
      sipp: p1Result.sipp * growthFactor(config.person1.sippAllocation.stocksPct),
      general: p1GeneralAfterBi * p1GiaGrowth,
    }
    p2Balances = {
      cash: p2Result.cash,
      isa: p2IsaAfterBi * growthFactor(config.person2.isaAllocation.stocksPct),
      sipp: p2Result.sipp * growthFactor(config.person2.sippAllocation.stocksPct),
      general: p2GeneralAfterBi * p2GiaGrowth,
    }

    p1GiaCostBasis *= p1GiaGrowth
    p2GiaCostBasis *= p2GiaGrowth

    const totalBedIsaCgt = p1BedIsaCgt + p2BedIsaCgt

    const endPortfolio =
      p1Balances.cash + p1Balances.isa + p1Balances.sipp + p1Balances.general +
      p2Balances.cash + p2Balances.isa + p2Balances.sipp + p2Balances.general

    // Milestone detection
    const milestones: string[] = []
    const currentP1Gia = p1Balances.general, currentP2Gia = p2Balances.general
    if (prevP1Gia > 0 && currentP1Gia <= 0) milestones.push(`${config.person1.name}'s GIA exhausted`)
    if (prevP2Gia > 0 && currentP2Gia <= 0) milestones.push(`${config.person2.name}'s GIA exhausted`)
    if (prevP1Sp === 0 && p1StatePension > 0) milestones.push(`${config.person1.name}'s state pension starts`)
    if (prevP2Sp === 0 && p2StatePension > 0) milestones.push(`${config.person2.name}'s state pension starts`)


    prevP1Gia = currentP1Gia; prevP2Gia = currentP2Gia
    prevP1Sp = p1StatePension; prevP2Sp = p2StatePension

    const totalCgt = Math.round(p1TaxResult.cgt + p2TaxResult.cgt + totalBedIsaCgt)

    projections.push({
      year: new Date().getFullYear() + year,
      age1, age2,
      portfolioValue: Math.round(endPortfolio),
      withdrawals: Math.round(portfolioNeeded),
      taxPaid: Math.round(totalTax + totalBedIsaCgt),
      incomeTax: Math.round(p1TaxResult.incomeTax + p2TaxResult.incomeTax),
      cgt: totalCgt,
      statePensionIncome: Math.round(statePensionTotal),
      otherIncome: Math.round(totalOtherIncome),
      netIncome: Math.round(netIncomeFromSources + portfolioNeeded - (p1TaxResult.portfolioTax + p2TaxResult.portfolioTax)),
      spending: Math.round(targetSpending),
      isaBalance: Math.round(p1Balances.isa + p2Balances.isa),
      sippBalance: Math.round(p1Balances.sipp + p2Balances.sipp),
      generalBalance: Math.round(p1Balances.general + p2Balances.general),
      cashBalance: Math.round(p1Balances.cash + p2Balances.cash),
      milestone: milestones.length > 0 ? milestones.join(' · ') : undefined,
    })
  }

  return projections
}

export function runMonteCarlo(
  config: HouseholdConfig,
  simulations: number = 1000,
  scenario?: ScenarioConfig
): MonteCarloResult {
  const maxYears = config.projectionYears ?? 40
  const results: number[][] = []

  // Calculate weighted average allocation across all invested assets
  const p1Invested = config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments
  const p2Invested = config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments
  const totalInvested = p1Invested + p2Invested || 1

  const weightedStocksPct = totalInvested > 0 ? (
    (config.person1.isaBalance * config.person1.isaAllocation.stocksPct +
     config.person1.sippBalance * config.person1.sippAllocation.stocksPct +
     config.person1.generalInvestments * config.person1.generalAllocation.stocksPct +
     config.person2.isaBalance * config.person2.isaAllocation.stocksPct +
     config.person2.sippBalance * config.person2.sippAllocation.stocksPct +
     config.person2.generalInvestments * config.person2.generalAllocation.stocksPct) / totalInvested
  ) : 70

  const mean = blendedReturn(weightedStocksPct)
  const stdDev = blendedVolatility(weightedStocksPct)

  const wc = config.withdrawalConfig ?? { method: "constant", percentOfPortfolio: 4, floorPct: 2.5, ceilingPct: 5, guardrailLower: 20, guardrailUpper: 20 }

  for (let sim = 0; sim < simulations; sim++) {
    const yearlyValues: number[] = []
    let totalPortfolio =
      config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments + config.person1.cashSavings +
      config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments + config.person2.cashSavings

    if (scenario?.marketCrash) {
      totalPortfolio *= (1 - (scenario.marketCrashPercent / 100))
    }

    const baseSpending = config.annualSpending + (scenario?.extraSpending || 0)
    const initialPortfolio = totalPortfolio
    const initialWithdrawalRate = totalPortfolio > 0 ? baseSpending / totalPortfolio : 0.04
    let prevSpending = baseSpending

    for (let year = 0; year < maxYears; year++) {
      const age1 = config.person1.age + year
      const age2 = config.person2.age + year

      const realMean = mean - (config.inflationRate ?? 0.025)
      const u1 = Math.random()
      const u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2)
      const yearReturn = realMean + stdDev * z

      // Income sources
      let income = 0
      if (config.person1.receivingStatePension || age1 >= config.person1.statePensionAge) {
        income += config.person1.statePensionAmount
      }
      if (config.person2.receivingStatePension || age2 >= config.person2.statePensionAge) {
        income += config.person2.statePensionAmount
      }
      for (const oi of [...config.person1.otherIncome, ...config.person2.otherIncome]) {
        income += oi.annualAmount
      }

      if (scenario?.delayStatePension) {
        income = 0
        const da1 = config.person1.statePensionAge + (scenario.delayYears || 0)
        const da2 = config.person2.statePensionAge + (scenario.delayYears || 0)
        if (age1 >= da1) income += config.person1.statePensionAmount
        if (age2 >= da2) income += config.person2.statePensionAmount
        for (const oi of [...config.person1.otherIncome, ...config.person2.otherIncome]) {
          income += oi.annualAmount
        }
      }

      // Apply withdrawal method to determine gross spending target
      let currentSpending = calculateTargetSpending(
        wc, baseSpending, totalPortfolio, initialPortfolio, initialWithdrawalRate, prevSpending
      )
      prevSpending = currentSpending

      if (scenario?.careCostEnabled && scenario.careCostAge > 0) {
        if (age1 >= scenario.careCostAge || age2 >= scenario.careCostAge) {
          currentSpending += scenario.annualCareCost
        }
      }

      if (scenario?.reduceSpending) {
        const startAge = scenario.reduceSpendingFromAge ?? 0
        const endAge = startAge + (scenario.reduceSpendingForYears ?? 0)
        const olderAge = Math.max(age1, age2)
        if (olderAge >= startAge && olderAge < endAge) {
          currentSpending = scenario.reducedSpendingAmount ?? currentSpending
        }
      }

      const portfolioNeeded = Math.max(0, currentSpending - income)
      totalPortfolio = Math.max(0, (totalPortfolio - portfolioNeeded) * (1 + yearReturn))
      yearlyValues.push(totalPortfolio)
    }

    results.push(yearlyValues)
  }

  // Calculate percentiles
  const percentiles = (pct: number): number[] => {
    const result: number[] = []
    for (let year = 0; year < maxYears; year++) {
      const values = results.map(r => r[year]).sort((a, b) => a - b)
      const idx = Math.floor(values.length * pct / 100)
      result.push(Math.round(values[idx]))
    }
    return result
  }

  const years = Array.from({ length: maxYears }, (_, i) => new Date().getFullYear() + i)

  // Exact survival rate at each year = % of simulations still above 0
  const survivalByYear = Array.from({ length: maxYears }, (_, year) => {
    const alive = results.filter(r => r[year] > 0).length
    return Math.round((alive / simulations) * 100)
  })

  return {
    percentile10: percentiles(10),
    percentile25: percentiles(25),
    median: percentiles(50),
    percentile75: percentiles(75),
    percentile90: percentiles(90),
    years,
    survivalByYear,
  }
}

export function calculateHealthScore(config: HouseholdConfig, scenario?: ScenarioConfig): HealthScore {
  const projection = generateProjection(config, 0.05, 0.025, scenario)

  const depletedYear = projection.findIndex(p => p.portfolioValue <= 0)
  const runwayYears = depletedYear === -1 ? 50 : depletedYear

  const mc = runMonteCarlo(config, 500, scenario)

  const totalPortfolio =
    config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments + config.person1.cashSavings +
    config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments + config.person2.cashSavings

  const yearsTo90 = Math.max(0, 90 - Math.max(config.person1.age, config.person2.age))
  const yearsTo95 = Math.max(0, 95 - Math.max(config.person1.age, config.person2.age))
  const yearsTo100 = Math.max(0, 100 - Math.max(config.person1.age, config.person2.age))

  const survivalAt = (yearIdx: number) => {
    if (yearIdx < 0 || yearIdx >= mc.survivalByYear.length) return yearIdx <= 0 ? 100 : 0
    return mc.survivalByYear[yearIdx]
  }

  const survivalProbability90 = yearsTo90 > 0 ? survivalAt(yearsTo90 - 1) : 100
  const survivalProbability95 = yearsTo95 > 0 ? survivalAt(yearsTo95 - 1) : 100
  const survivalProbability100 = yearsTo100 > 0 ? survivalAt(yearsTo100 - 1) : 100

  const sustainableRate = totalPortfolio > 0 ? 4.0 : 0
  const actualRate = totalPortfolio > 0
    ? ((config.annualSpending - getPersonTotalIncome({ ...config.person1, age: config.person1.age }) - getPersonTotalIncome({ ...config.person2, age: config.person2.age })) / totalPortfolio) * 100
    : 0

  // Max safe spending: binary search for spending level that keeps portfolio alive to age 95
  let maxSafeSpending = config.annualSpending
  if (totalPortfolio > 0) {
    let lo = config.annualSpending, hi = totalPortfolio * 0.15
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      const testConfig = { ...config, annualSpending: mid }
      const testProjection = generateProjection(testConfig, 0.05, config.inflationRate)
      const survivesTo95 = testProjection[yearsTo95 - 1]?.portfolioValue > 0
      if (survivesTo95) lo = mid
      else hi = mid
    }
    maxSafeSpending = Math.round(lo / 100) * 100
  }

  let status: "on-track" | "review-needed" | "at-risk" = "on-track"
  let label = "On Track"

  if (survivalProbability90 < 60 || runwayYears < (90 - Math.max(config.person1.age, config.person2.age))) {
    status = "at-risk"
    label = "At Risk"
  } else if (survivalProbability90 < 85 || actualRate > sustainableRate * 1.2) {
    status = "review-needed"
    label = "Review Needed"
  }

  return {
    status, label, runwayYears,
    survivalProbability90, survivalProbability95, survivalProbability100,
    sustainableRate: Math.round(sustainableRate * 10) / 10,
    actualRate: Math.round(actualRate * 10) / 10,
    maxSafeSpending,
  }
}

export function getDefaultConfig(): HouseholdConfig {
  return {
    person1: {
      name: "Partner 1",
      age: 67,
      isaBalance: 180000,
      sippBalance: 420000,
      generalInvestments: 75000,
      giaCostBasis: 55000,
      cashSavings: 35000,
      annualDrawdown: 28000,
      drawdownOrder: ["cash", "isa", "general", "sipp"],
      receivingStatePension: true,
      statePensionAge: 67,
      statePensionAmount: 11502,
      taxFreeLumpSumTaken: true,
      otherIncome: [],
      useScottishTax: false,
      isaAllocation: { stocksPct: 80 },
      sippAllocation: { stocksPct: 60 },
      generalAllocation: { stocksPct: 70 },
      bedAndIsa: { enabled: false, annualAmount: 20000, startAge: 67, untilExhausted: true, years: 5 },
    },
    person2: {
      name: "Partner 2",
      age: 65,
      isaBalance: 120000,
      sippBalance: 280000,
      generalInvestments: 45000,
      giaCostBasis: 35000,
      cashSavings: 25000,
      annualDrawdown: 22000,
      drawdownOrder: ["cash", "isa", "general", "sipp"],
      receivingStatePension: false,
      statePensionAge: 67,
      statePensionAmount: 11502,
      taxFreeLumpSumTaken: true,
      otherIncome: [],
      useScottishTax: false,
      isaAllocation: { stocksPct: 80 },
      sippAllocation: { stocksPct: 60 },
      generalAllocation: { stocksPct: 70 },
      bedAndIsa: { enabled: false, annualAmount: 20000, startAge: 67, untilExhausted: true, years: 5 },
    },
    annualSpending: 42000,
    projectionYears: 40,
    includeNI: false,
    inflationRate: 0.025,
    stocksReturn: 0.10,
    bondsReturn: 0.045,
    tripleLockStatePension: false,
    withdrawalConfig: {
      method: "constant",
      percentOfPortfolio: 4,
      floorPct: 2.5,
      ceilingPct: 5,
      guardrailLower: 20,
      guardrailUpper: 20,
    },
    spendingPhases: [],
  }
}

export function getDefaultScenario(): ScenarioConfig {
  return {
    extraSpending: 0,
    marketCrash: false,
    marketCrashPercent: 20,
    careCostAge: 85,
    careCostEnabled: false,
    annualCareCost: 50000,
    delayStatePension: false,
    delayYears: 1,
    reduceSpending: false,
    reducedSpendingAmount: 28000,
    reduceSpendingFromAge: 80,
    reduceSpendingForYears: 5,
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

// Calculate exact survival probability to a target age by counting simulations
// Uses same logic as runMonteCarlo but returns a real percentage (0-100)
export function calcSurvivalProbability(
  config: HouseholdConfig,
  targetAge: number,
  simulations: number = 400
): number {
  const yearsToTarget = Math.max(0, targetAge - Math.max(config.person1.age, config.person2.age))
  if (yearsToTarget <= 0) return 100

  const p1Invested = config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments
  const p2Invested = config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments
  const totalInvested = p1Invested + p2Invested || 1

  const weightedStocksPct = (
    config.person1.isaBalance * config.person1.isaAllocation.stocksPct +
    config.person1.sippBalance * config.person1.sippAllocation.stocksPct +
    config.person1.generalInvestments * config.person1.generalAllocation.stocksPct +
    config.person2.isaBalance * config.person2.isaAllocation.stocksPct +
    config.person2.sippBalance * config.person2.sippAllocation.stocksPct +
    config.person2.generalInvestments * config.person2.generalAllocation.stocksPct
  ) / totalInvested

  const mean = blendedReturn(weightedStocksPct)
  const stdDev = blendedVolatility(weightedStocksPct)
  const realMean = mean - (config.inflationRate ?? 0.025)

  let survived = 0

  for (let sim = 0; sim < simulations; sim++) {
    let portfolio =
      config.person1.isaBalance + config.person1.sippBalance + config.person1.generalInvestments + config.person1.cashSavings +
      config.person2.isaBalance + config.person2.sippBalance + config.person2.generalInvestments + config.person2.cashSavings

    let alive = true
    for (let year = 0; year < yearsToTarget; year++) {
      const age1 = config.person1.age + year
      const age2 = config.person2.age + year

      // Income
      let income = 0
      if (config.person1.receivingStatePension || age1 >= config.person1.statePensionAge) income += config.person1.statePensionAmount
      if (config.person2.receivingStatePension || age2 >= config.person2.statePensionAge) income += config.person2.statePensionAmount
      for (const oi of [...config.person1.otherIncome, ...config.person2.otherIncome]) income += oi.annualAmount

      const needed = Math.max(0, config.annualSpending - income)

      // Random return
      const u1 = Math.random(), u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2)
      const yearReturn = realMean + stdDev * z

      portfolio = Math.max(0, (portfolio - needed) * (1 + yearReturn))
      if (portfolio <= 0) { alive = false; break }
    }
    if (alive) survived++
  }

  return Math.round((survived / simulations) * 100)
}
