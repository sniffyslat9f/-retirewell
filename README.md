# Retirewell

A UK retirement financial planning dashboard for couples. Models portfolio sustainability using real UK tax rules, flexible withdrawal strategies, and Monte Carlo simulation.

## Live site
**[retirewell-pi.vercel.app](https://retirewell-pi.vercel.app)**

## Features
- Income from ISAs, SIPPs, general investments, and cash savings
- UK income tax (including Scottish rates) and capital gains tax
- State pension with triple-lock growth and deferment options
- Bed & ISA transfer planning with CGT calculations
- Four withdrawal strategies: constant spending, fixed %, Vanguard dynamic, Guyton-Klinger
- Monte Carlo simulation (800 runs) with survival probability
- Historical sequence testing using S&P 500 data from 1920–2023
- What-if scenarios: market crash, care costs, extra spending, reduced spending
- Save and load configurations as JSON
- Print-friendly PDF summary

## Running locally
```bash
npm install
npm run dev
```
Then open [http://localhost:3000](http://localhost:3000).

## Deploying
Push to the `main` branch on GitHub — Vercel deploys automatically.

```bash
git add .
git commit -m "your message"
git push origin main
```
