import type { TaxRegime } from '../utils/tax'

export const REGIME_LABEL: Record<TaxRegime, string> = {
  new: 'New regime',
  old: 'Old regime',
}

export const REGIME_OPTIONS: TaxRegime[] = ['new', 'old']

/**
 * localStorage key for the theme choice. The no-flash script in index.html
 * reads this same key literally — change one and you must change the other.
 */
export const THEME_STORAGE_KEY = 'easy-tax:theme'
