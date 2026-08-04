import type { BreakdownRow } from '../interfaces'
import { formatRate } from './common'
import type { TaxCalculationResult } from './tax'

/**
 * Turns a calculation into the rows shown beside the form, in the order the
 * Income Tax Act applies them. Rows flagged `hideWhenZero` are dropped by the
 * view, so a simple salaried case stays short while a complex one expands.
 */
export const buildBreakdown = (
  result: TaxCalculationResult,
): BreakdownRow[] => [
  { label: 'Gross total income', value: result.grossTotalIncome },
  {
    label: 'Standard deduction',
    value: result.standardDeduction,
    negative: true,
    hideWhenZero: true,
  },
  {
    label: 'Business expenses',
    value: result.businessExpenses.allowed,
    negative: true,
    hideWhenZero: true,
    note: 's.37',
  },
  {
    label: 'Loss from house property',
    value: result.homeLoanInterest.allowed,
    negative: true,
    hideWhenZero: true,
    note: 'home-loan interest · s.24(b)',
  },
  {
    label: 'Deduction u/s 80C',
    value: result.deductions.section80C.allowed,
    negative: true,
    hideWhenZero: true,
  },
  {
    label: 'Deduction u/s 80D',
    value: result.deductions.section80D.allowed,
    negative: true,
    hideWhenZero: true,
  },
  {
    label: 'Deduction u/s 80E',
    value: result.deductions.section80E.allowed,
    negative: true,
    hideWhenZero: true,
    note: 'education loan interest',
  },
  {
    label: 'Deduction u/s 80G',
    value: result.deductions.section80G.allowed,
    negative: true,
    hideWhenZero: true,
    note: 'donations',
  },
  { label: 'Total income', value: result.totalIncome, emphasis: true },
  { label: 'Tax at slab rates', value: result.tax.slab },
  {
    label: 'Tax on long-term capital gain',
    value: result.tax.longTermCapitalGain,
    hideWhenZero: true,
    note: '12.5% · s.112A',
  },
  {
    label: 'Tax on short-term capital gain',
    value: result.tax.shortTermCapitalGain,
    hideWhenZero: true,
    note: '20% · s.111A',
  },
  {
    label: 'Tax on crypto & VDA gain',
    value: result.tax.cryptoGain,
    hideWhenZero: true,
    note: '30% · s.115BBH',
  },
  {
    label: 'Rebate u/s 87A',
    value: result.rebate87A,
    negative: true,
    hideWhenZero: true,
  },
  {
    label: 'Surcharge',
    value: result.surcharge,
    hideWhenZero: true,
    note: formatRate(result.surchargeRate),
  },
  {
    label: 'Marginal relief on surcharge',
    value: result.surchargeMarginalRelief,
    negative: true,
    hideWhenZero: true,
  },
  {
    label: 'Health & education cess',
    value: result.cess,
    hideWhenZero: true,
    note: '4%',
  },
  // Last, because it caps the final bill with cess already in it.
  {
    label: 'Marginal relief u/s 87A',
    value: result.marginalRelief87A,
    negative: true,
    hideWhenZero: true,
    note: 'caps tax at income above ₹12L',
  },
]
