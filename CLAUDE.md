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
