import type { TaxRegime } from '../utils/tax'

export const REGIME_LABEL: Record<TaxRegime, string> = {
  new: 'New regime',
  old: 'Old regime',
}

export const REGIME_OPTIONS: TaxRegime[] = ['new', 'old']
