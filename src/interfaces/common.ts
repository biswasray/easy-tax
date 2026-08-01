import type { TaxDataOptionType } from '../utils/tax'

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

export type FieldConfig = {
  key: AmountField
  label: string
  /** How this bucket is taxed, shown under the input. */
  hint: string
  /** Business/other income can be a loss and set off against other income. */
  allowNegative?: boolean
  /** Statutory ceiling, for deduction fields. */
  getLimit?: (seniorParents: boolean) => number
}

export type FieldGroup = {
  title: string
  fields: FieldConfig[]
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
