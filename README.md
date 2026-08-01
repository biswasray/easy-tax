# easy-tax

An Indian income-tax calculator for **FY 2025-26 (AY 2026-27)**. Enter what you
earned, pick a regime, and see the tax broken down line by line — including the
bits most calculators hide, like which slab your income actually filled, why
your surcharge went down, and what the other regime would have cost you.

Built with React 19, TypeScript and Vite.

## Getting started

```bash
yarn install
yarn dev
```

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `yarn dev`          | Start the dev server with HMR              |
| `yarn build`        | Typecheck and build to `dist/`             |
| `yarn preview`      | Serve the production build locally         |
| `yarn lint`         | ESLint                                     |
| `yarn format`       | Format everything with Prettier            |
| `yarn format:check` | Verify formatting without writing (for CI) |

## Deployment

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which lints, checks formatting, typechecks, builds, and publishes `dist/` to
GitHub Pages at **https://biswasray.github.io/easy-tax/**. Pull requests run the
same checks without deploying.

Because a project site is served from a subpath, `vite.config.ts` builds with
`base: '/easy-tax/'`. On a custom domain or a `<user>.github.io` repository,
build with `VITE_BASE=/` instead.

One-time setup: **Settings → Pages → Source: GitHub Actions**.

### Releasing

A deploy only happens when the version has gone up. The build writes its
`package.json` version into `dist/version.json`, and CI compares that against
the copy already live at `/easy-tax/version.json`:

| package.json | Live site | Result                               |
| ------------ | --------- | ------------------------------------ |
| `1.0.1`      | `1.0.0`   | Deploys                              |
| `1.0.0`      | `1.0.0`   | Builds and verifies, skips deploying |
| `1.0.0`      | _absent_  | Deploys — treated as a first release |

So to ship a change, bump the version:

```bash
yarn version --new-version patch   # or minor / major
```

Pushes that do not bump the version still run the full lint, format and build
checks and go green — they just don't publish. Because the comparison is against
what is actually live rather than against the previous commit, a deploy that
fails or is skipped is picked up again by the next run.

`yarn.lock` is not committed, so CI resolves dependency versions fresh on every
run. A build can therefore pick up a new release of a dependency that was never
built locally.

## What it works out

All the logic lives in [`src/utils/tax.ts`](src/utils/tax.ts) as a single pure
function, `calculateTax(data)`. It returns a full `TaxCalculationResult` rather
than a bare number, so the UI can show its working.

### Income

| Input                                         | Treatment                                        |
| --------------------------------------------- | ------------------------------------------------ |
| Salary                                        | Slab rates, after the standard deduction         |
| FD & savings interest, dividend, other income | Slab rates                                       |
| Intraday trading                              | Speculative business income → slab rates         |
| Equity & commodity F&O                        | Non-speculative business income → slab rates     |
| Long-term capital gain                        | 12.5% above the ₹1,25,000 exemption — s.112A     |
| Short-term capital gain                       | 20% — s.111A                                     |
| Crypto & VDA gain                             | Flat 30%, no deductions, no exemption — s.115BBH |

### Deductions

| Section                      | Limit                                         |
| ---------------------------- | --------------------------------------------- |
| Standard deduction           | ₹75,000 new regime · ₹50,000 old regime       |
| 80C                          | ₹1,50,000                                     |
| 80D — self, spouse, children | ₹25,000                                       |
| 80D — parents                | ₹25,000, or ₹50,000 when they are 60 or older |

80C and 80D are **old regime only**, and the two 80D sub-limits are separate —
unused self/family room cannot absorb an overspend on the parents' policy.
Chapter VI-A deductions reduce slab income only; they can never be set off
against capital gains or crypto taxed at special rates.

### And then

- Unused basic exemption set off against STCG first, then LTCG (STCG is taxed
  higher, so absorbing it first minimises the bill). Crypto is excluded, as
  s.115BBH requires.
- Rebate u/s 87A — ₹60,000 up to ₹12L of total income under the new regime,
  ₹12,500 up to ₹5L under the old. No rebate against LTCG or crypto, and none
  against 111A short-term gains under the new regime.
- Marginal relief u/s 87A once the new regime's ₹12L threshold is passed: the
  rebate is gone, but the tax payable is limited to the amount by which total
  income overshoots ₹12,00,000, so a raise can never cost more in tax than it
  added in income. Applied last, to the final bill **including cess** — total
  income of ₹12,50,000 pays ₹50,000, not ₹67,500 plus cess. It stops short of
  tax on capital gains and crypto, which section 87A cannot touch. The old
  regime has no equivalent: ₹5L is a hard cliff.
- Surcharge at 10/15/25% (plus 37% over ₹5cr in the old regime), with the 15%
  cap on the part attributable to 111A, 112A and dividend income.
- Marginal relief where crossing a surcharge threshold would otherwise cost
  more in tax than the extra income earned.
- 4% health and education cess, and rounding to the nearest ₹10 per s.288B.

## Assumptions

The calculator is built for one taxpayer profile, and the rates are named
constants at the top of `src/utils/tax.ts` so they are easy to bump each year:

- Resident individual **under 60** — no senior-citizen slabs.
- Deductions are limited to 80C and 80D. HRA, LTA, 80CCD(1B), 80E, 80G, 24(b)
  home-loan interest and the rest are not modelled, so the old regime will look
  worse than it really is if you rely on them.
- Losses are not carried forward. A negative business or other-income figure
  sets off against other income within the same calculation only, with no
  speculative/non-speculative ring-fencing.

It is an estimate to help you compare regimes, not a filing tool. Check with a
tax professional before you file.

## Example

```ts
import { calculateTax } from './src/utils'

const result = calculateTax({
  taxRegime: 'old',
  salaryIncomeAnnually: 1000000,
  section80CAnnually: 150000,
  section80DSelfFamilyAnnually: 25000,
})

result.totalIncome // 775000
result.totalTaxPayable // 70200
result.deductions.section80C // { claimed: 150000, allowed: 150000, limit: 150000 }
```
