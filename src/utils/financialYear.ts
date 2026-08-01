/** India's financial year runs 1 April to 31 March. Zero-based, so 3 = April. */
const FINANCIAL_YEAR_START_MONTH = 3

/**
 * A financial year is identified by the calendar year it starts in, so
 * FY 2025-26 is 2025. Dates in January to March belong to the year before.
 */
export const getFinancialYearStart = (date: Date = new Date()) =>
  date.getMonth() >= FINANCIAL_YEAR_START_MONTH
    ? date.getFullYear()
    : date.getFullYear() - 1

/** "2025-26" from 2025, keeping the two-digit tail padded across centuries. */
const span = (startYear: number) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`

export const formatFinancialYear = (startYear: number) =>
  `FY ${span(startYear)}`

/** The assessment year is the one after the financial year it assesses. */
export const formatAssessmentYear = (startYear: number) =>
  `AY ${span(startYear + 1)}`

/** e.g. "FY 2025-26 (AY 2026-27)". */
export const formatTaxYear = (startYear: number) =>
  `${formatFinancialYear(startYear)} (${formatAssessmentYear(startYear)})`
