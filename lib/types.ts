export interface AllocationConfig {
  stocksPct: number  // 0-100, remainder is bonds
}

export interface OtherIncome {
  label: string
  annualAmount: number
  type: "rental" | "parttime" | "annuity" | "db_pension" | "other"
  // If false, this income stays level in cash terms (e.g. a level annuity) and so
  // erodes in today's-money terms each year. If true/undefined, it rises with inflation.
  increasesWithInflation?: boolean
}

export interface BedAndIsaConfig {
  enabled: boolean
  annualAmount: number
  startAge: number
  untilExhausted: boolean  // if true, continue until GIA is empty (ignore years)
  years: number            // only used when untilExhausted is false
}

export interface SpendingPhase {
  label: string       // e.g. "Go-go years", "Slow-go", "No-go"
  annualAmount: number
  untilAge: number    // spending at this level until the older partner reaches this age
}

export type WithdrawalMethod =
  | "constant"          // fixed real amount (current behaviour)
  | "percent"           // fixed % of current portfolio each year
  | "vanguard_dynamic"  // Vanguard dynamic: % of portfolio with floor/ceiling
  | "guyton_klinger"    // Guyton-Klinger guardrails

export interface WithdrawalConfig {
  method: WithdrawalMethod
  // For percent / vanguard_dynamic / guyton_klinger:
  percentOfPortfolio: number   // e.g. 4 for 4%
  // Vanguard dynamic floor/ceiling as % change from prior year spending:
  floorPct: number             // e.g. 2.5 — never cut more than 2.5% in real terms
  ceilingPct: number           // e.g. 5 — never raise more than 5% in real terms
  // Guyton-Klinger guardrails:
  guardrailLower: number       // e.g. 20 — cut spending 10% if withdrawal rate rises 20% above initial
  guardrailUpper: number       // e.g. 20 — raise spending 10% if withdrawal rate falls 20% below initial
}

export type AccountType = "cash" | "isa" | "sipp" | "general"

export interface HouseholdConfig {
  person1: PersonConfig
  person2: PersonConfig
  annualSpending: number
  projectionYears: number  // how many years to project (default 40)
  includeNI: boolean
  inflationRate: number
  stocksReturn: number        // e.g. 0.10 for 10% nominal
  bondsReturn: number         // e.g. 0.045 for 4.5% nominal
  tripleLockStatePension: boolean
  withdrawalConfig: WithdrawalConfig
  spendingPhases: SpendingPhase[]  // empty = use annualSpending flat
}

export interface PersonConfig {
  name: string
  age: number
  isaBalance: number
  sippBalance: number
  generalInvestments: number
  giaCostBasis: number
  cashSavings: number
  annualDrawdown: number
  drawdownOrder: AccountType[]
  receivingStatePension: boolean
  statePensionAge: number
  statePensionAmount: number
  taxFreeLumpSumTaken: boolean
  otherIncome: OtherIncome[]
  useScottishTax: boolean
  isaAllocation: AllocationConfig
  sippAllocation: AllocationConfig
  generalAllocation: AllocationConfig
  bedAndIsa: BedAndIsaConfig
}

export interface YearProjection {
  year: number
  age1: number
  age2: number
  portfolioValue: number
  withdrawals: number
  taxPaid: number
  incomeTax: number
  cgt: number           // total CGT including bed & ISA transfers
  statePensionIncome: number
  otherIncome: number
  netIncome: number
  spending: number
  isaBalance: number
  sippBalance: number
  generalBalance: number
  cashBalance: number
  milestone?: string
}

export interface EstateProjection {
  age: number
  portfolioValue: number
  year: number
}

export interface HealthScore {
  status: "on-track" | "review-needed" | "at-risk"
  label: string
  runwayYears: number
  survivalProbability90: number
  survivalProbability95: number
  survivalProbability100: number
  sustainableRate: number
  actualRate: number
  maxSafeSpending: number   // maximum annual spending that keeps portfolio alive to 95
}

export interface MonteCarloResult {
  percentile10: number[]
  percentile25: number[]
  median: number[]
  percentile75: number[]
  percentile90: number[]
  years: number[]
  survivalByYear: number[]
}

export interface ScenarioConfig {
  extraSpending: number
  marketCrash: boolean
  marketCrashPercent: number
  careCostAge: number
  careCostEnabled: boolean
  annualCareCost: number
  delayStatePension: boolean
  delayYears: number
  reduceSpending: boolean
  reducedSpendingAmount: number
  reduceSpendingFromAge: number
  reduceSpendingForYears: number
}
