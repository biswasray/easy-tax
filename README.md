# easy-tax

An Indian income-tax calculator for <!-- tax-year:start -->**FY 2025-26 (AY 2026-27)**<!-- tax-year:end -->.
Enter what you earned, pick a regime, and see the tax broken down line by line —
including the bits most calculators hide, like which slab your income actually
filled, why your surcharge went down, and what the other regime would have cost
you.

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
| `yarn sync:readme`  | Refresh the generated year fields below    |

### Generated fields

Markdown cannot compute anything when GitHub renders it, so the two dated
fields in this file are written in by
[`scripts/sync-readme.mjs`](scripts/sync-readme.mjs) and committed. Each sits
between HTML comment markers that are invisible once rendered:

| Region      | Source                                            |
| ----------- | ------------------------------------------------- |
| `tax-year`  | `RATE_FINANCIAL_YEAR_START` in `src/utils/tax.ts` |
| `copyright` | The current calendar year                         |

The tax year deliberately follows the rates rather than the clock, so this file
can never claim a year the calculator does not implement. CI runs
`yarn sync:readme:check` and fails if either has drifted — including on 1
January, when the copyright year turns over. Run `yarn sync:readme` and commit.

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

| Deduction                     | Limit                                         | Regime |
| ----------------------------- | --------------------------------------------- | ------ |
| 10(13A) — HRA                 | The least of three tests, below               | Old    |
| Standard deduction            | ₹75,000 new regime · ₹50,000 old regime       | Both   |
| Business expenses — s.37      | Your business income                          | Both   |
| 80C                           | ₹1,50,000                                     | Old    |
| 80CCD(1B) — NPS               | ₹50,000, on top of 80C                        | Old    |
| 80D — self, spouse, children  | ₹25,000                                       | Old    |
| 80D — parents                 | ₹25,000, or ₹50,000 when they are 60 or older | Old    |
| 80E — education loan interest | No ceiling                                    | Old    |
| 80G — donations at 100%       | No qualifying limit                           | Old    |
| 80G — donations at 50%        | 10% of adjusted gross total income            | Old    |
| 24(b) — home-loan interest    | ₹2,00,000                                     | Old    |

Everything except the standard deduction and business expenses reduces slab
income only; none of it can be set off against capital gains or crypto taxed at
special rates. The two 80D sub-limits are separate, so unused self/family room
cannot absorb an overspend on the parents' policy.

**HRA** is an exemption rather than a deduction, so it comes off salary before
everything else, the standard deduction included. Rule 2A makes it the least of
three figures: the HRA you were paid, 50% of basic salary in Delhi, Mumbai,
Kolkata or Chennai (40% anywhere else), and the rent you paid over 10% of basic.
"Salary" there means basic plus DA, not gross pay, which is why the form asks
for basic separately — and why the HRA you enter is not added to your income
again, since it is already inside the salary figure. The results panel names all
three tests so you can see which one bound. Pay no rent and nothing is exempt,
however much HRA your payslip shows.

**80CCD(1B)** is the extra ₹50,000 of NPS that section 80CCE leaves outside the
₹1,50,000 pool, so a maxed-out 80C does not eat into it. Employer contributions
under 80CCD(2) — the one deduction the new regime does allow — are not modelled,
because the ceiling depends on basic pay in ways the form does not capture.

**80G** models the two common categories. The 100% one — PM National Relief
Fund, PM CARES, the National Defence Fund — is deductible in full. The 50% one
covers registered trusts and NGOs: half of what you give is deductible, and
only the part falling within 10% of your adjusted gross total income, which is
slab income after the standard deduction, business expenses, the house-property
loss and the other chapter VI-A deductions. Donations over ₹2,000 paid in cash
do not qualify, and the calculator takes your word that they were not.

**24(b)** is the interest on a loan for the house you live in, not the
principal — that belongs in 80C. It becomes a loss from house property and is
set off against your other income. The ₹2,00,000 ceiling doubles as the section
71(3A) cap on that set-off, so one figure does for both. The new regime allows
neither the deduction nor the set-off.

### Expenses and GST

GST is not an income-tax deduction. Paying it on a phone bill or a restaurant
meal does nothing for your income tax, and there is no field for it.

Where it counts is as a business cost. The GST charged on your brokerage — along
with the brokerage itself, exchange and demat charges, data feeds and
subscriptions — is an expense of earning intraday and F&O income, deductible
under section 37. This one works under **both** regimes, because it is a cost of
the business rather than a chapter VI-A deduction. Enter the total under
**Business expenses**.

Two limits apply. Only GST you could not reclaim as input tax credit is a cost
at all; if you are GST-registered and claimed the credit, leave it out. And the
deduction stops at your business income, because a business loss cannot be set
against salary (s.71(2A)) and losses are not modelled here — expenses beyond the
income they belong to are dropped rather than carried anywhere.

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
constants at the top of `src/utils/tax.ts` so they are easy to bump each year.

`RATE_FINANCIAL_YEAR_START` in that file records which year those rates belong
to, and the header labels itself from it — so the displayed FY and AY can never
drift away from the rates in use. To roll the app forward, update the rates and
that one constant together. Until then the app compares the constant against
today's date and says plainly that the current year's rates are not in yet.

Other assumptions:

- Resident individual **under 60** — no senior-citizen slabs.
- Deductions are limited to those listed above. LTA, 80CCD(2) employer NPS,
  80TTA savings interest and 80GG rent are not modelled, so the old regime will
  look worse than it really is if you rely on them.
- Only a **self-occupied** house is modelled. Rent received, the 30% standard
  deduction against it and a let-out property's uncapped interest are not.
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

---

Copyright © <!-- copyright:start -->2026<!-- copyright:end -->
