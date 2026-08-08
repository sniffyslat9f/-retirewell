# Retirewell — Claude Context

## What this app is
A UK retirement financial planning dashboard for couples. Users input their assets, pensions, and spending plans; the app models portfolio sustainability over time using tax calculations, withdrawal strategies, and Monte Carlo simulation.

## Live deployment
- **GitHub:** `github.com/sniffyslat9f/-retirewell` (main branch)
- **Vercel:** `retirewell-pi.vercel.app` — auto-deploys when main branch is pushed
- **Local working copy:** `~/Desktop/Retirewell v2/retirewell`

To deploy changes: commit and push to GitHub (`git push origin main`). Vercel deploys automatically within ~1 minute.

## Tech stack
- **Next.js** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** for styling
- **Recharts** for all charts
- **shadcn/ui** components (New York style) in `components/ui/`
- **React Hook Form** + **Zod** for form validation

## Key files
| File | Purpose |
|------|---------|
| `lib/engine.ts` | Core calculation engine — UK tax, projections, Monte Carlo, Bed & ISA logic (~1000 lines) |
| `lib/types.ts` | All TypeScript interfaces (HouseholdConfig, YearProjection, etc.) |
| `lib/historical-returns.ts` | S&P 500 real returns 1920–2023 for historical sequence testing |
| `app/page.tsx` | Main dashboard — state management, layout, import/export |
| `components/dashboard/` | Feature components: config form, charts, table, health summary, scenarios, print |

## UK tax features
- Income tax with Scottish rates option
- Personal allowance taper above £100k
- Capital gains tax with annual allowance
- Bed & ISA transfers with CGT calculation
- State pension with triple-lock growth and deferment

## Withdrawal strategies supported
- Constant spending (inflation-adjusted)
- Fixed percentage of portfolio
- Vanguard dynamic (% of portfolio with floor/ceiling)
- Guyton-Klinger guardrails

## Owner
Ben Comley — non-technical user. Keep explanations in plain English.

## Build notes

### Testing pass + rate-based withdrawal fix (Aug 2026)
Ben reviewed this app alongside its private sibling [[RetireWell Assistant]] (`~/Desktop/RetireWell Assistant`), which shares this engine but tracks his real holdings. Extended `tests/run-tests.cjs` with 8 combined-scenario tests (interaction bugs between tax rules — SIPP + GIA gain, income straddling the CGT band boundary, confirming Scottish taxpayers correctly use the UK CGT threshold not Scottish income bands, dividends stacking near a used-up band) — no bugs found, 44/44 passing at that point.

**Real bug found and fixed the same day**: "Percentage of portfolio," Vanguard dynamic, and Guyton-Klinger were blending guaranteed income (state pension, a DB pension) into the withdrawal rate — the rate was applied to a *combined* target (portfolio + pension), then the pension was subtracted to find the portfolio withdrawal. This understated the actual portfolio withdrawal by roughly the pension amount every year, and doesn't match the standard definition of a safe withdrawal rate (the 4% rule and similar are calibrated against portfolio survival specifically, since only the portfolio carries market risk — guaranteed income is meant to sit separately on top). Caught by comparing real output against RetireWell Assistant (which already had this right) and against ficalc.app directly, with the pension-convention variable isolated and confirmed via a direct engine test (with vs without pension, everything else held equal) plus the sourced definition of the 4% rule.
Fixed in `lib/engine.ts` `generateProjection`: rate-based methods (`percent`, `vanguard_dynamic`, `guyton_klinger`) now apply the rate to the portfolio directly and add net income from sources afterward; `constant` (and spending phases) are unchanged — they represent a fixed *total* spending target, where letting guaranteed income offset the portfolio need is correct.
Verified: `npx tsc --noEmit` clean, `npm run build` clean, `npm test` 48/48 passing (4 new tests specifically lock in: portfolio withdrawal ≈ rate × portfolio unaffected by pension presence/absence; pension correctly added on top of the total; `constant` method's old offsetting behaviour is unchanged). On Ben's real numbers (£891,738 portfolio, 3% method, £14,500 DB pension): portfolio withdrawal went from ~£12,638/yr (wrong) to ~£27,500/yr (correct, ≈3% of portfolio net of tax).
**Lesson**: this wasn't a maths error — every individual number was calculated correctly given what it was told to calculate. It was a modelling-convention question (what does "3%" mean when other income exists), which is why it survived an earlier, careful, test-covered build and even a separate model's review — it only surfaced by comparing real outputs against real-world expectations (the reference tool this app was modelled on, and the sourced definition of the strategies themselves), not by reading the code in isolation.
