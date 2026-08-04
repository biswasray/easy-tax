import type { FieldGroup, FormState } from '../interfaces'
import { DEDUCTION_LIMITS } from '../utils/tax'

export const INCOME_GROUPS: FieldGroup[] = [
  {
    title: 'Salary & other income',
    fields: [
      {
        key: 'salaryIncomeAnnually',
        label: 'Salary',
        hint: 'Slab rates, after standard deduction',
      },
      {
        key: 'fdInterestIncomeAnnually',
        label: 'FD & savings interest',
        hint: 'Slab rates',
      },
      {
        key: 'dividendIncomeAnnually',
        label: 'Dividend',
        hint: 'Slab rates, surcharge capped at 15%',
      },
      {
        key: 'otherIncomeAnnually',
        label: 'Other income',
        hint: 'Slab rates',
        allowNegative: true,
      },
    ],
  },
  {
    title: 'Capital gains',
    fields: [
      {
        key: 'longTermCapitalGainAnnually',
        label: 'Long-term capital gain',
        hint: '12.5% above ₹1.25L exempt · s.112A',
      },
      {
        key: 'shortTermCapitalGainAnnually',
        label: 'Short-term capital gain',
        hint: '20% · s.111A',
      },
      {
        key: 'cryptoGainIncomeAnnually',
        label: 'Crypto & VDA gain',
        hint: 'Flat 30%, no deductions · s.115BBH',
      },
    ],
  },
  {
    title: 'Trading & business',
    fields: [
      {
        key: 'intradayTradingIncomeAnnually',
        label: 'Intraday trading',
        hint: 'Speculative business · slab rates',
        allowNegative: true,
      },
      {
        key: 'equityFnoTradingIncomeAnnually',
        label: 'Equity F&O',
        hint: 'Non-speculative business · slab rates',
        allowNegative: true,
      },
      {
        key: 'commodityFnoTradingIncomeAnnually',
        label: 'Commodity F&O',
        hint: 'Non-speculative business · slab rates',
        allowNegative: true,
      },
      {
        key: 'businessExpensesAnnually',
        label: 'Business expenses',
        hint: 'Brokerage, exchange and demat charges, the GST charged on them, internet and data subscriptions — the cost of earning the trading income above. Allowed under both regimes · s.37.',
        getLimit: ({ result }) => result.businessExpenses.limit,
        limitLabel: 'business income',
      },
    ],
  },
]

export const DEDUCTION_GROUPS: FieldGroup[] = [
  {
    title: 'Deductions — chapter VI-A',
    regimes: ['old'],
    showSeniorParentsToggle: true,
    note: {
      new: 'The new regime allows no chapter VI-A deduction. Anything you enter here is kept and applied the moment you switch to the old regime.',
      old: 'Deductions reduce salary, interest and business income only — they cannot be set off against capital gains or crypto.',
    },
    fields: [
      {
        key: 'section80CAnnually',
        label: 'Section 80C',
        hint: 'EPF, PPF, ELSS, life-insurance premium, home-loan principal, children’s tuition fees, 5-year FD, Sukanya Samriddhi.',
        getLimit: () => DEDUCTION_LIMITS.section80C,
      },
      {
        key: 'section80DSelfFamilyAnnually',
        label: 'Section 80D — self, spouse & children',
        hint: 'Health-insurance premium for your own family, including up to ₹5,000 of preventive health check-ups.',
        getLimit: () => DEDUCTION_LIMITS.section80DSelfFamily,
      },
      {
        key: 'section80DParentsAnnually',
        label: 'Section 80D — parents',
        hint: 'Health-insurance premium paid for your parents, whether or not they are dependent on you.',
        getLimit: ({ seniorParents }) =>
          seniorParents
            ? DEDUCTION_LIMITS.section80DSeniorParents
            : DEDUCTION_LIMITS.section80DParents,
      },
      {
        key: 'section80EAnnually',
        label: 'Section 80E — education loan interest',
        hint: 'Interest on a loan for higher education, for you, your spouse or your children. No ceiling — but only the interest counts, never the principal, and only for eight years from the first repayment.',
      },
      {
        key: 'section80GFullAnnually',
        label: 'Section 80G — donations at 100%',
        hint: 'Funds deductible in full with no qualifying limit: PM National Relief Fund, PM CARES, the National Defence Fund. Cash gifts over ₹2,000 do not count.',
      },
      {
        key: 'section80GHalfAnnually',
        label: 'Section 80G — donations at 50%',
        hint: 'Registered trusts and NGOs. Half of what you give is deductible, and only the part within 10% of your adjusted gross total income. Cash gifts over ₹2,000 do not count.',
        getLimit: ({ result }) => result.deductions.section80G.limit,
        limitLabel: 'qualifying limit',
      },
    ],
  },
  {
    title: 'Home loan — section 24(b)',
    regimes: ['old'],
    note: {
      new: 'The new regime allows neither the interest deduction nor the set-off against your other income.',
      old: 'For the house you live in. The loan principal belongs under 80C instead.',
    },
    fields: [
      {
        key: 'homeLoanInterestAnnually',
        label: 'Home-loan interest',
        hint: 'Interest paid on the loan for a self-occupied house. It becomes a loss from house property and is set off against the rest of your income.',
        getLimit: () => DEDUCTION_LIMITS.homeLoanInterest,
      },
    ],
  },
]

const ALL_GROUPS = [...INCOME_GROUPS, ...DEDUCTION_GROUPS]

export const FIELD_KEYS = ALL_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key),
)

/** Blank value for every field, used as the initial and reset form state. */
export const EMPTY_FORM = Object.fromEntries(
  FIELD_KEYS.map((key) => [key, '']),
) as FormState
