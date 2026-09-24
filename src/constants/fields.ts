import type { FieldGroup, FlagState, FormState } from '../interfaces'
import { formatCurrency } from '../utils/common'
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
        allowNegative: true,
      },
      {
        key: 'shortTermCapitalGainAnnually',
        label: 'Short-term capital gain',
        hint: '20% · s.111A',
        allowNegative: true,
      },
      {
        key: 'cryptoGainIncomeAnnually',
        label: 'Crypto & VDA gain',
        hint: 'Flat 30%, no deductions · s.115BBH',
        allowNegative: true,
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
    title: 'House rent allowance — section 10(13A)',
    regimes: ['old'],
    note: {
      new: 'The new regime withdraws the HRA exemption altogether.',
      old: 'The exemption is the least of three tests, so all three figures are needed. It comes off your salary before anything else.',
    },
    toggles: [
      {
        key: 'livesInMetroCity',
        label: 'I live in a metro city',
        hint: 'Delhi, Mumbai, Kolkata or Chennai. Raises the salary test from 40% to 50% of basic.',
      },
    ],
    fields: [
      {
        key: 'basicSalaryAnnually',
        label: 'Basic salary + DA',
        hint: 'Rule 2A means basic pay plus dearness allowance by “salary”, not your gross pay — every test below is a percentage of this figure.',
      },
      {
        key: 'hraReceivedAnnually',
        label: 'HRA received',
        hint: 'The house-rent allowance in your pay structure. It is already inside the salary you entered above, so it is not counted as income twice.',
      },
      {
        key: 'rentPaidAnnually',
        label: 'Rent paid',
        hint: 'Rent you actually paid for the year. Nothing is exempt unless it exceeds 10% of your basic salary.',
      },
    ],
  },
  {
    title: 'Deductions — chapter VI-A',
    regimes: ['old'],
    toggles: [
      {
        key: 'parentsAreSeniorCitizens',
        label: 'My parents are 60 or older',
        hint: `Raises the 80D parents limit from ${formatCurrency(
          DEDUCTION_LIMITS.section80DParents,
        )} to ${formatCurrency(DEDUCTION_LIMITS.section80DSeniorParents)}.`,
      },
    ],
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
        key: 'section80CCD1BAnnually',
        label: 'Section 80CCD(1B) — NPS',
        hint: 'Your own contribution to the National Pension System, on top of the 80C ceiling rather than inside it. Employer contributions belong to 80CCD(2), which is not modelled.',
        getLimit: () => DEDUCTION_LIMITS.section80CCD1B,
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
        getLimit: ({ flags }) =>
          flags.parentsAreSeniorCitizens
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

const TOGGLE_KEYS = ALL_GROUPS.flatMap((group) =>
  (group.toggles ?? []).map((toggle) => toggle.key),
)

/** Blank value for every field, used as the initial and reset form state. */
export const EMPTY_FORM = Object.fromEntries(
  FIELD_KEYS.map((key) => [key, '']),
) as FormState

export const EMPTY_FLAGS = Object.fromEntries(
  TOGGLE_KEYS.map((key) => [key, false]),
) as FlagState
