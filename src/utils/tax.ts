/**
 * Income-tax calculator for a resident individual in India.
 *
 * Assumptions baked into these rates (documented so they are easy to bump):
 *  - FY 2025-26 / AY 2026-27.
 *  - Resident individual below 60 years of age (no senior-citizen slabs).
 *  - Chapter VI-A deductions are limited to 80C and 80D, and only the old
 *    regime allows them. They reduce slab income only — they can never be set
 *    off against capital gains or crypto taxed at special rates.
 *  - Losses are not carried forward; a negative bucket only sets off against
 *    other income in the same calculation.
 */

export type TaxDataOptionType = {
  taxRegime: 'old' | 'new'
  salaryIncomeAnnually?: number
  longTermCapitalGainAnnually?: number
  shortTermCapitalGainAnnually?: number
  dividendIncomeAnnually?: number
  fdInterestIncomeAnnually?: number
  intradayTradingIncomeAnnually?: number
  equityFnoTradingIncomeAnnually?: number
  commodityFnoTradingIncomeAnnually?: number
  cryptoGainIncomeAnnually?: number
  otherIncomeAnnually?: number
  /** Section 80C investments and payments. Old regime only. */
  section80CAnnually?: number
  /** Section 80D health premium for self, spouse and children. */
  section80DSelfFamilyAnnually?: number
  /** Section 80D health premium for parents. */
  section80DParentsAnnually?: number
  /** Raises the 80D parents sub-limit from ₹25,000 to ₹50,000. */
  parentsAreSeniorCitizens?: boolean
}

export type TaxRegime = TaxDataOptionType['taxRegime']

export type TaxSlabRow = {
  /** Lower bound of the slab, exclusive of the previous slab. */
  from: number
  /** Upper bound of the slab, `null` for the topmost open-ended slab. */
  to: number | null
  rate: number
  taxableAmount: number
  tax: number
}

export type DeductionSummary = {
  /** What the taxpayer entered. */
  claimed: number
  /** What the section actually permits, after the cap. */
  allowed: number
  /** The ceiling that applied, given the regime and the inputs. */
  limit: number
}

export type TaxCalculationResult = {
  taxRegime: TaxRegime
  grossTotalIncome: number
  standardDeduction: number
  deductions: {
    section80C: DeductionSummary
    section80D: DeductionSummary
    /** Allowed 80C + 80D. Always zero under the new regime. */
    total: number
  }
  /** Gross total income less the standard deduction and chapter VI-A. */
  totalIncome: number
  /** Portion of total income taxed at the ordinary slab rates. */
  slabIncome: number
  specialRateIncome: {
    longTermCapitalGain: number
    shortTermCapitalGain: number
    cryptoGain: number
  }
  /** Unused basic exemption set off against STCG/LTCG. */
  basicExemptionUsedAgainstSpecialIncome: number
  slabs: TaxSlabRow[]
  tax: {
    slab: number
    longTermCapitalGain: number
    shortTermCapitalGain: number
    cryptoGain: number
    beforeRebate: number
  }
  /** Section 87A rebate. Zero once total income passes the threshold. */
  rebate87A: number
  /**
   * Section 87A marginal relief, which replaces the rebate just above the
   * ₹12,00,000 threshold. New regime only — the old regime is a hard cliff.
   */
  marginalRelief87A: number
  taxAfterRebate: number
  surchargeRate: number
  surcharge: number
  /** Relief for crossing a surcharge threshold. Unrelated to 87A. */
  surchargeMarginalRelief: number
  cess: number
  /** Rounded to the nearest ₹10 as required by section 288B. */
  totalTaxPayable: number
  /** Total tax as a fraction of gross total income (0 when there is no income). */
  effectiveTaxRate: number
}

const CESS_RATE = 0.04

/** Section 112A: listed equity / equity mutual fund long-term gains. */
const LTCG_112A_RATE = 0.125
const LTCG_112A_EXEMPTION = 125000

/** Section 111A: listed equity / equity mutual fund short-term gains. */
const STCG_111A_RATE = 0.2

/** Section 115BBH: virtual digital assets, flat rate with no deductions. */
const VDA_115BBH_RATE = 0.3

const SLABS: Record<TaxRegime, { upTo: number; rate: number }[]> = {
  new: [
    { upTo: 400000, rate: 0 },
    { upTo: 800000, rate: 0.05 },
    { upTo: 1200000, rate: 0.1 },
    { upTo: 1600000, rate: 0.15 },
    { upTo: 2000000, rate: 0.2 },
    { upTo: 2400000, rate: 0.25 },
    { upTo: Infinity, rate: 0.3 },
  ],
  old: [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ],
}

const STANDARD_DEDUCTION: Record<TaxRegime, number> = { new: 75000, old: 50000 }

/** Section 80C ceiling. */
const SECTION_80C_LIMIT = 150000

/**
 * Section 80D sub-limits. `self` assumes the taxpayer is under 60, matching the
 * age assumption of this module; the parents' limit rises when they are 60+.
 */
const SECTION_80D_LIMITS = {
  self: 25000,
  parents: 25000,
  seniorParents: 50000,
}

/** Published so the UI can label each field without restating the numbers. */
export const DEDUCTION_LIMITS = {
  section80C: SECTION_80C_LIMIT,
  section80DSelfFamily: SECTION_80D_LIMITS.self,
  section80DParents: SECTION_80D_LIMITS.parents,
  section80DSeniorParents: SECTION_80D_LIMITS.seniorParents,
} as const

const BASIC_EXEMPTION: Record<TaxRegime, number> = { new: 400000, old: 250000 }

/** Section 87A: income ceiling and maximum rebate. */
const REBATE_87A: Record<
  TaxRegime,
  { incomeLimit: number; maxRebate: number }
> = {
  new: { incomeLimit: 1200000, maxRebate: 60000 },
  old: { incomeLimit: 500000, maxRebate: 12500 },
}

/** Ordered high to low; the first matching band wins. */
const SURCHARGE_BANDS: Record<TaxRegime, { above: number; rate: number }[]> = {
  new: [
    { above: 20000000, rate: 0.25 },
    { above: 10000000, rate: 0.15 },
    { above: 5000000, rate: 0.1 },
  ],
  old: [
    { above: 50000000, rate: 0.37 },
    { above: 20000000, rate: 0.25 },
    { above: 10000000, rate: 0.15 },
    { above: 5000000, rate: 0.1 },
  ],
}

/** Surcharge on 111A / 112A / dividend income is capped at this rate. */
const SURCHARGE_CAP_ON_SPECIAL_INCOME = 0.15

const round2 = (value: number) => Math.round(value * 100) / 100

const roundToNearestTen = (value: number) => Math.round(value / 10) * 10

const num = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const atLeastZero = (value: number) => (value > 0 ? value : 0)

/** Income buckets after the standard deduction, split by how they are taxed. */
type IncomeBuckets = {
  slab: number
  /** Dividend is tracked separately only because its surcharge is capped. */
  dividend: number
  ltcg: number
  stcg: number
  crypto: number
}

const buildSlabRows = (income: number, regime: TaxRegime): TaxSlabRow[] => {
  let lower = 0

  return SLABS[regime].map(({ upTo, rate }) => {
    const taxableAmount = atLeastZero(Math.min(income, upTo) - lower)
    const row: TaxSlabRow = {
      from: lower,
      to: Number.isFinite(upTo) ? upTo : null,
      rate,
      taxableAmount,
      tax: round2(taxableAmount * rate),
    }
    lower = upTo
    return row
  })
}

type CoreTax = {
  slabs: TaxSlabRow[]
  slabTax: number
  ltcgTax: number
  stcgTax: number
  cryptoTax: number
  taxBeforeRebate: number
  /** The part of the tax that section 87A is allowed to reduce. */
  rebatableTax: number
  rebate: number
  taxAfterRebate: number
  exemptionUsedAgainstSpecialIncome: number
}

/**
 * Tax up to (but excluding) surcharge and cess. Kept as a pure function of the
 * buckets so marginal relief can re-run it against a reduced income.
 */
const computeCoreTax = (buckets: IncomeBuckets, regime: TaxRegime): CoreTax => {
  const slabRows = buildSlabRows(buckets.slab, regime)
  const slabTax = round2(slabRows.reduce((total, row) => total + row.tax, 0))

  // Unused basic exemption is set off against special-rate capital gains. The
  // higher-taxed STCG is absorbed first because that minimises the liability.
  // Section 115BBH explicitly denies this benefit to crypto gains.
  let unusedExemption = atLeastZero(BASIC_EXEMPTION[regime] - buckets.slab)
  const exemptionAgainstStcg = Math.min(unusedExemption, buckets.stcg)
  unusedExemption -= exemptionAgainstStcg

  const taxableLtcg = atLeastZero(buckets.ltcg - LTCG_112A_EXEMPTION)
  const exemptionAgainstLtcg = Math.min(unusedExemption, taxableLtcg)

  const stcgTax = round2((buckets.stcg - exemptionAgainstStcg) * STCG_111A_RATE)
  const ltcgTax = round2((taxableLtcg - exemptionAgainstLtcg) * LTCG_112A_RATE)
  const cryptoTax = round2(buckets.crypto * VDA_115BBH_RATE)

  const taxBeforeRebate = round2(slabTax + stcgTax + ltcgTax + cryptoTax)

  const totalIncome =
    buckets.slab + buckets.ltcg + buckets.stcg + buckets.crypto
  const { incomeLimit, maxRebate } = REBATE_87A[regime]

  // Whichever relief applies, it can only wipe out tax charged at the slab
  // rates. Under the old regime section 111A gains also qualify; 112A gains
  // and crypto never do.
  const rebatableTax = regime === 'old' ? slabTax + stcgTax : slabTax

  // Past the threshold the rebate is gone outright. What replaces it is
  // marginal relief, and that is deliberately not computed here: it caps the
  // final bill including cess, so calculateTax applies it at the very end.
  const rebate =
    totalIncome <= incomeLimit ? round2(Math.min(rebatableTax, maxRebate)) : 0

  return {
    slabs: slabRows,
    slabTax,
    ltcgTax,
    stcgTax,
    cryptoTax,
    taxBeforeRebate,
    rebatableTax,
    rebate,
    taxAfterRebate: round2(taxBeforeRebate - rebate),
    exemptionUsedAgainstSpecialIncome: round2(
      exemptionAgainstStcg + exemptionAgainstLtcg,
    ),
  }
}

/**
 * Trims buckets down to `target` total income, taking the reduction from
 * ordinary income first. Used to value the hypothetical "income exactly at the
 * surcharge threshold" that marginal relief compares against.
 */
const reduceIncomeTo = (
  buckets: IncomeBuckets,
  target: number,
): IncomeBuckets => {
  const total = buckets.slab + buckets.ltcg + buckets.stcg + buckets.crypto
  let excess = atLeastZero(total - target)

  const take = (available: number) => {
    const taken = Math.min(available, excess)
    excess -= taken
    return available - taken
  }

  const slab = take(buckets.slab)
  const dividend = Math.min(buckets.dividend, slab)
  const crypto = take(buckets.crypto)
  const stcg = take(buckets.stcg)
  const ltcg = take(buckets.ltcg)

  return { slab, dividend, crypto, stcg, ltcg }
}

/**
 * Chapter VI-A deductions. The new regime allows neither section, so every
 * limit collapses to zero and the claimed amounts are reported back unchanged
 * so the UI can still show what was forgone by choosing it.
 */
const computeDeductions = (
  data: TaxDataOptionType,
  regime: TaxRegime,
): TaxCalculationResult['deductions'] => {
  const claimed80C = atLeastZero(num(data.section80CAnnually))
  const claimedSelf = atLeastZero(num(data.section80DSelfFamilyAnnually))
  const claimedParents = atLeastZero(num(data.section80DParentsAnnually))
  const claimed80D = claimedSelf + claimedParents

  if (regime === 'new') {
    return {
      section80C: { claimed: claimed80C, allowed: 0, limit: 0 },
      section80D: { claimed: claimed80D, allowed: 0, limit: 0 },
      total: 0,
    }
  }

  // 80D is two separate sub-limits rather than one pooled ceiling, so an
  // overspend on the parents' policy cannot soak up unused self/family room.
  const parentsLimit = data.parentsAreSeniorCitizens
    ? SECTION_80D_LIMITS.seniorParents
    : SECTION_80D_LIMITS.parents

  const allowed80C = Math.min(claimed80C, SECTION_80C_LIMIT)
  const allowed80D =
    Math.min(claimedSelf, SECTION_80D_LIMITS.self) +
    Math.min(claimedParents, parentsLimit)

  return {
    section80C: {
      claimed: claimed80C,
      allowed: allowed80C,
      limit: SECTION_80C_LIMIT,
    },
    section80D: {
      claimed: claimed80D,
      allowed: allowed80D,
      limit: SECTION_80D_LIMITS.self + parentsLimit,
    },
    total: round2(allowed80C + allowed80D),
  }
}

export const calculateTax = (data: TaxDataOptionType): TaxCalculationResult => {
  const regime = data.taxRegime

  const salary = num(data.salaryIncomeAnnually)
  const dividend = num(data.dividendIncomeAnnually)
  const ltcg = atLeastZero(num(data.longTermCapitalGainAnnually))
  const stcg = atLeastZero(num(data.shortTermCapitalGainAnnually))
  const crypto = atLeastZero(num(data.cryptoGainIncomeAnnually))

  // Intraday is speculative business income and F&O is non-speculative
  // business income, but both are ultimately taxed at slab rates.
  const otherSlabIncome =
    dividend +
    num(data.fdInterestIncomeAnnually) +
    num(data.intradayTradingIncomeAnnually) +
    num(data.equityFnoTradingIncomeAnnually) +
    num(data.commodityFnoTradingIncomeAnnually) +
    num(data.otherIncomeAnnually)

  const grossTotalIncome = round2(
    salary + otherSlabIncome + ltcg + stcg + crypto,
  )

  // The standard deduction is only available against salary income.
  const standardDeduction = Math.min(
    atLeastZero(salary),
    STANDARD_DEDUCTION[regime],
  )

  const deductions = computeDeductions(data, regime)

  const slabIncome = atLeastZero(
    round2(salary - standardDeduction + otherSlabIncome - deductions.total),
  )

  const buckets: IncomeBuckets = {
    slab: slabIncome,
    // Clamped because deductions can shrink slab income below the dividend.
    dividend: Math.min(atLeastZero(dividend), slabIncome),
    ltcg,
    stcg,
    crypto,
  }

  const totalIncome = round2(
    buckets.slab + buckets.ltcg + buckets.stcg + buckets.crypto,
  )

  const core = computeCoreTax(buckets, regime)

  const band = SURCHARGE_BANDS[regime].find(({ above }) => totalIncome > above)
  const surchargeRate = band?.rate ?? 0

  // Surcharge on 111A, 112A and dividend income is capped at 15%, so the tax is
  // split into a capped and an uncapped part before the rate is applied.
  const dividendTax =
    buckets.slab > 0 ? (core.slabTax * buckets.dividend) / buckets.slab : 0
  const cappedTax = core.stcgTax + core.ltcgTax + dividendTax
  const uncappedTax = atLeastZero(core.taxAfterRebate - cappedTax)

  const surcharge = round2(
    uncappedTax * surchargeRate +
      Math.min(cappedTax, core.taxAfterRebate) *
        Math.min(surchargeRate, SURCHARGE_CAP_ON_SPECIAL_INCOME),
  )

  // Marginal relief caps the extra tax at the extra income earned over the
  // surcharge threshold.
  let surchargeMarginalRelief = 0
  if (band && surcharge > 0) {
    const taxAtThreshold = computeCoreTax(
      reduceIncomeTo(buckets, band.above),
      regime,
    ).taxAfterRebate
    const ceiling = taxAtThreshold + (totalIncome - band.above)
    surchargeMarginalRelief = round2(
      atLeastZero(core.taxAfterRebate + surcharge - ceiling),
    )
  }

  const taxPlusSurcharge = atLeastZero(
    round2(core.taxAfterRebate + surcharge - surchargeMarginalRelief),
  )
  const cess = round2(taxPlusSurcharge * CESS_RATE)
  const totalBeforeRelief = round2(taxPlusSurcharge + cess)

  /*
   * Section 87A marginal relief, applied last because it caps the bill the
   * taxpayer actually writes a cheque for — cess included. Someone whose total
   * income crosses ₹12,00,000 by ₹50,000 must never pay more than ₹50,000 of
   * extra tax, so the whole ₹70,200 figure is what gets capped, not the
   * ₹67,500 sitting underneath it.
   *
   * The floor stops the relief reaching tax that section 87A cannot touch:
   * capital gains and crypto keep their own tax, grossed up for cess.
   */
  let marginalRelief87A = 0
  const { incomeLimit } = REBATE_87A[regime]

  if (regime === 'new' && totalIncome > incomeLimit) {
    const overshoot = totalIncome - incomeLimit
    const untouchableTax = round2(
      (core.taxBeforeRebate - core.rebatableTax) * (1 + CESS_RATE),
    )
    const capped = Math.max(
      Math.min(totalBeforeRelief, overshoot),
      untouchableTax,
    )
    marginalRelief87A = round2(atLeastZero(totalBeforeRelief - capped))
  }

  const totalTaxPayable = roundToNearestTen(
    atLeastZero(totalBeforeRelief - marginalRelief87A),
  )

  return {
    taxRegime: regime,
    grossTotalIncome,
    standardDeduction,
    deductions,
    totalIncome,
    slabIncome: buckets.slab,
    specialRateIncome: {
      longTermCapitalGain: ltcg,
      shortTermCapitalGain: stcg,
      cryptoGain: crypto,
    },
    basicExemptionUsedAgainstSpecialIncome:
      core.exemptionUsedAgainstSpecialIncome,
    slabs: core.slabs,
    tax: {
      slab: core.slabTax,
      longTermCapitalGain: core.ltcgTax,
      shortTermCapitalGain: core.stcgTax,
      cryptoGain: core.cryptoTax,
      beforeRebate: core.taxBeforeRebate,
    },
    rebate87A: core.rebate,
    taxAfterRebate: core.taxAfterRebate,
    surchargeRate,
    surcharge,
    marginalRelief87A,
    surchargeMarginalRelief,
    cess,
    totalTaxPayable,
    effectiveTaxRate:
      grossTotalIncome > 0
        ? Math.round((totalTaxPayable / grossTotalIncome) * 10000) / 10000
        : 0,
  }
}
