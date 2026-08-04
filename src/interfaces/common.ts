import type {
  TaxCalculationResult,
  TaxDataOptionType,
  TaxRegime,
} from '../utils/tax'

/**
 * Every amount field on the form, i.e. every key of the calculator input
 * except the regime and the senior-parents flag. Derived from the calculator's
 * own type, so adding an input there surfaces here as a type error until the
 * form accounts for it.
 */
export type AmountField = {
  [K in keyof TaxDataOptionType]-?: TaxDataOptionType[K] extends
    number | undefined
    ? K
    : never
}[keyof TaxDataOptionType]

/**
 * What a field needs to work out its ceiling. Some are fixed by statute, but
 * 80G's qualifying limit and the cap on business expenses both fall out of the
 * calculation itself, so the whole result is on offer.
 */
export type LimitContext = {
  seniorParents: boolean
  result: TaxCalculationResult
}

export type FieldConfig = {
  key: AmountField
  label: string
  /** How this bucket is taxed, shown under the input. */
  hint: string
  /** Business/other income can be a loss and set off against other income. */
  allowNegative?: boolean
  /** Statutory ceiling, for deduction fields. */
  getLimit?: (context: LimitContext) => number
  /**
   * Names a ceiling that is not a flat statutory figure, e.g. "business
   * income". Changes the wording from "Limit ₹X" to "Capped at your ₹X …".
   */
  limitLabel?: string
}

export type FieldGroup = {
  title: string
  fields: FieldConfig[]
  /** Shown under the legend, worded per regime. */
  note?: Record<TaxRegime, string>
  /** Regimes where the group does anything. Undefined means both. */
  regimes?: TaxRegime[]
  /** Renders the "my parents are 60 or older" toggle after the fields. */
  showSeniorParentsToggle?: boolean
}

/** A single line of the tax breakdown shown beside the form. */
export type BreakdownRow = {
  label: string
  value: number
  /** Shown as a subtraction, e.g. the standard deduction. */
  negative?: boolean
  /** Rows that are only meaningful when non-zero. */
  hideWhenZero?: boolean
  emphasis?: boolean
  note?: string
}

/** The form's raw text state: digits as typed, before parsing to numbers. */
export type FormState = Record<AmountField, string>

export type Theme = 'light' | 'dark'

export type ThemeContextValue = {
  /** The theme in effect, whether chosen explicitly or inherited from the OS. */
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  /** True while no explicit choice is stored, i.e. the OS is still in charge. */
  isSystemTheme: boolean
}
