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
    ],
  },
]

export const DEDUCTION_GROUP: FieldGroup = {
  title: 'Deductions — chapter VI-A',
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
      getLimit: (seniorParents) =>
        seniorParents
          ? DEDUCTION_LIMITS.section80DSeniorParents
          : DEDUCTION_LIMITS.section80DParents,
    },
  ],
}

const ALL_GROUPS = [...INCOME_GROUPS, DEDUCTION_GROUP]

export const FIELD_KEYS = ALL_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key),
)

/** Blank value for every field, used as the initial and reset form state. */
export const EMPTY_FORM = Object.fromEntries(
  FIELD_KEYS.map((key) => [key, '']),
) as FormState
