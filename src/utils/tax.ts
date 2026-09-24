/**
 * Income-tax calculator for a resident individual in India.
 *
 * Assumptions baked into these rates (documented so they are easy to bump):
 *  - FY 2025-26 / AY 2026-27.
 *  - Resident individual below 60 years of age (no senior-citizen slabs).
 *  - Chapter VI-A deductions are limited to 80C, 80D, 80E and 80G, and only the
 *    old regime allows them. So is the section 24(b) home-loan interest. They
 *    reduce slab income only — none of them can be set off against capital
 *    gains or crypto taxed at special rates.
 *  - Section 37 business expenses are the exception: they are a cost of earning
 *    business income rather than a chapter VI-A deduction, so both regimes
 *    allow them.
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
  /**
   * Basic salary plus dearness allowance, which is what rule 2A means by
   * "salary". Only used to size the HRA exemption.
   */
  basicSalaryAnnually?: number
  /** The HRA component of the salary above, not income on top of it. */
  hraReceivedAnnually?: number
  /** Rent actually paid, for the section 10(13A) exemption. */
  rentPaidAnnually?: number
  /**
   * Section 37 expenses of earning the trading income above — brokerage, the
   * GST charged on it, data subscriptions. Allowed under both regimes.
   */
  businessExpensesAnnually?: number
  /** Section 80C investments and payments. Old regime only. */
  section80CAnnually?: number
  /** Section 80D health premium for self, spouse and children. */
  section80DSelfFamilyAnnually?: number
  /** Section 80D health premium for parents. */
  section80DParentsAnnually?: number
  /** Section 80CCD(1B) NPS, which sits outside the 80CCE ₹1,50,000 pool. */
  section80CCD1BAnnually?: number
  /** Section 80E interest on an education loan. No monetary ceiling. */
  section80EAnnually?: number
  /** Section 80G donations deductible in full, with no qualifying limit. */
  section80GFullAnnually?: number
  /** Section 80G donations deductible at 50%, within the qualifying limit. */
  section80GHalfAnnually?: number
  /** Section 24(b) interest on a loan for a self-occupied house. */
  homeLoanInterestAnnually?: number
  /** Raises the 80D parents sub-limit from ₹25,000 to ₹50,000. */
  parentsAreSeniorCitizens?: boolean
  /** Raises the HRA salary test from 40% to 50%. */
  livesInMetroCity?: boolean
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

/**
 * Section 10(13A) read with rule 2A. The exemption is the least of three
 * tests, all of which are reported so the UI can show which one bit.
 */
export type HraSummary = {
  /** HRA received, as entered. */
  received: number
  /** Basic salary plus DA, clamped to the salary entered. */
  basicSalary: number
  rentPaid: number
  /** True when the 50% metro test applies instead of 40%. */
  metro: boolean
  /** The share of basic that applied, so the UI need not restate the statute. */
  salaryShareRate: number
  tests: {
    received: number
    /** 50% of basic in a metro city, 40% elsewhere. */
    salaryShare: number
    /** Rent paid less 10% of basic. */
    rentOverThreshold: number
  }
  /** The least of the three. Always zero under the new regime. */
  exempt: number
}

export type TaxCalculationResult = {
  taxRegime: TaxRegime
  grossTotalIncome: number
  /** Section 10(13A) HRA exemption, taken off salary before everything else. */
  hra: HraSummary
  standardDeduction: number
  /**
   * Section 37 expenses netted off business income. Allowed under both
   * regimes, and capped at the business income itself.
   */
  businessExpenses: DeductionSummary
  /**
   * Section 24(b) interest, set off as a loss from house property. Its `limit`
   * is zero under the new regime, which allows neither the deduction nor the
   * set-off.
   */
  homeLoanInterest: DeductionSummary
  deductions: {
    section80C: DeductionSummary
    /** NPS, on top of 80C rather than inside its ₹1,50,000 pool. */
    section80CCD1B: DeductionSummary
    section80D: DeductionSummary
    /** Education-loan interest, which has no ceiling — `limit` is Infinity. */
    section80E: DeductionSummary
    /**
     * Donations. `limit` is the qualifying limit — 10% of adjusted gross total
     * income — which caps the 50% category only; the fully deductible
     * category is not capped at all.
     */
    section80G: DeductionSummary
    /** Everything allowed above. Always zero under the new regime. */
    total: number
  }
  /**
   * Gross total income less the standard deduction, business expenses, the
   * house-property loss and chapter VI-A.
   */
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

/**
 * The financial year every rate in this file belongs to, identified by the
 * calendar year it starts in — 2025 means FY 2025-26 / AY 2026-27. The UI
 * labels itself from this, so bumping the rates below and bumping this
 * constant is what moves the app to a new year. Never derive the displayed
 * year from the clock alone: the label would advance while the rates did not.
 */
export const RATE_FINANCIAL_YEAR_START = 2025

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

/** Section 80C ceiling — the section 80CCE pool, which 80CCD(1B) sits outside. */
const SECTION_80C_LIMIT = 150000

/** Section 80CCD(1B): additional NPS, over and above the 80CCE pool. */
const SECTION_80CCD_1B_LIMIT = 50000

/**
 * Section 10(13A) with rule 2A. "Salary" throughout means basic plus DA, not
 * gross pay, which is why the form asks for basic separately.
 */
const HRA_SALARY_SHARE = { metro: 0.5, nonMetro: 0.4 }
const HRA_RENT_THRESHOLD = 0.1

/**
 * Section 80D sub-limits. `self` assumes the taxpayer is under 60, matching the
 * age assumption of this module; the parents' limit rises when they are 60+.
 */
const SECTION_80D_LIMITS = {
  self: 25000,
  parents: 25000,
  seniorParents: 50000,
}

/**
 * Section 80G: donations in the "with qualifying limit" categories count only
 * up to this share of adjusted gross total income, and only half of what
 * qualifies is deductible.
 */
const SECTION_80G_QUALIFYING_RATE = 0.1
const SECTION_80G_HALF_RATE = 0.5

/**
 * Section 24(b) interest on a self-occupied house. The same figure caps the
 * house-property loss that section 71(3A) lets you set against other heads, so
 * one number does for both.
 */
const HOME_LOAN_INTEREST_LIMIT = 200000

/** Published so the UI can label each field without restating the numbers. */
export const DEDUCTION_LIMITS = {
  section80C: SECTION_80C_LIMIT,
  section80CCD1B: SECTION_80CCD_1B_LIMIT,
  section80DSelfFamily: SECTION_80D_LIMITS.self,
  section80DParents: SECTION_80D_LIMITS.parents,
  section80DSeniorParents: SECTION_80D_LIMITS.seniorParents,
  section80GQualifyingRate: SECTION_80G_QUALIFYING_RATE,
  homeLoanInterest: HOME_LOAN_INTEREST_LIMIT,
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
 * Section 10(13A) with rule 2A: the exemption is the least of the HRA
 * received, a share of basic salary, and rent paid over 10% of basic. All
 * three are reported so the UI can show which one bound.
 *
 * Basic is clamped to the gross salary entered — an inflated basic would
 * otherwise let the percentage tests exempt more than was ever earned.
 */
const computeHra = (
  data: TaxDataOptionType,
  regime: TaxRegime,
  salary: number,
): HraSummary => {
  const basicSalary = Math.min(
    atLeastZero(num(data.basicSalaryAnnually)),
    atLeastZero(salary),
  )
  const received = Math.min(
    atLeastZero(num(data.hraReceivedAnnually)),
    atLeastZero(salary),
  )
  const rentPaid = atLeastZero(num(data.rentPaidAnnually))
  const metro = data.livesInMetroCity === true
  const salaryShareRate = metro
    ? HRA_SALARY_SHARE.metro
    : HRA_SALARY_SHARE.nonMetro

  const tests = {
    received,
    salaryShare: round2(basicSalary * salaryShareRate),
    rentOverThreshold: round2(
      atLeastZero(rentPaid - basicSalary * HRA_RENT_THRESHOLD),
    ),
  }

  return {
    received,
    basicSalary,
    rentPaid,
    metro,
    salaryShareRate,
    tests,
    // The new regime withdraws 10(13A) outright (s.115BAC).
    exempt: regime === 'old' ? Math.min(...Object.values(tests)) : 0,
  }
}

/**
 * Chapter VI-A deductions. The new regime allows none of these sections, so
 * every limit collapses to zero and the claimed amounts are reported back
 * unchanged so the UI can still show what was forgone by choosing it.
 *
 * `incomeBeforeChapterVIA` is slab income after the standard deduction, the
 * section 37 expenses and the house-property loss, but before this function's
 * own deductions. Section 80G needs it to work out its qualifying limit.
 */
const computeDeductions = (
  data: TaxDataOptionType,
  regime: TaxRegime,
  incomeBeforeChapterVIA: number,
): TaxCalculationResult['deductions'] => {
  const claimed80C = atLeastZero(num(data.section80CAnnually))
  const claimed80CCD1B = atLeastZero(num(data.section80CCD1BAnnually))
  const claimedSelf = atLeastZero(num(data.section80DSelfFamilyAnnually))
  const claimedParents = atLeastZero(num(data.section80DParentsAnnually))
  const claimed80D = claimedSelf + claimedParents
  const claimed80E = atLeastZero(num(data.section80EAnnually))
  const claimed80GFull = atLeastZero(num(data.section80GFullAnnually))
  const claimed80GHalf = atLeastZero(num(data.section80GHalfAnnually))
  const claimed80G = claimed80GFull + claimed80GHalf

  if (regime === 'new') {
    return {
      section80C: { claimed: claimed80C, allowed: 0, limit: 0 },
      section80CCD1B: { claimed: claimed80CCD1B, allowed: 0, limit: 0 },
      section80D: { claimed: claimed80D, allowed: 0, limit: 0 },
      section80E: { claimed: claimed80E, allowed: 0, limit: 0 },
      section80G: { claimed: claimed80G, allowed: 0, limit: 0 },
      total: 0,
    }
  }

  // 80D is two separate sub-limits rather than one pooled ceiling, so an
  // overspend on the parents' policy cannot soak up unused self/family room.
  const parentsLimit = data.parentsAreSeniorCitizens
    ? SECTION_80D_LIMITS.seniorParents
    : SECTION_80D_LIMITS.parents

  const allowed80C = Math.min(claimed80C, SECTION_80C_LIMIT)
  // Deliberately not pooled with 80C: section 80CCE excludes 80CCD(1B) from
  // the ₹1,50,000 ceiling, which is the whole point of the sub-section.
  const allowed80CCD1B = Math.min(claimed80CCD1B, SECTION_80CCD_1B_LIMIT)
  const allowed80D =
    Math.min(claimedSelf, SECTION_80D_LIMITS.self) +
    Math.min(claimedParents, parentsLimit)
  // Only the interest is deductible, and there is no ceiling on it.
  const allowed80E = claimed80E

  // Section 80G(4): the qualifying limit is 10% of adjusted gross total
  // income, i.e. gross total income less the other chapter VI-A deductions and
  // less income taxed at special rates — which slab income already excludes.
  const adjustedGrossTotalIncome = atLeastZero(
    round2(
      incomeBeforeChapterVIA -
        allowed80C -
        allowed80CCD1B -
        allowed80D -
        allowed80E,
    ),
  )
  const qualifyingLimit = round2(
    adjustedGrossTotalIncome * SECTION_80G_QUALIFYING_RATE,
  )
  const allowed80G = round2(
    claimed80GFull +
      Math.min(claimed80GHalf, qualifyingLimit) * SECTION_80G_HALF_RATE,
  )

  return {
    section80C: {
      claimed: claimed80C,
      allowed: allowed80C,
      limit: SECTION_80C_LIMIT,
    },
    section80CCD1B: {
      claimed: claimed80CCD1B,
      allowed: allowed80CCD1B,
      limit: SECTION_80CCD_1B_LIMIT,
    },
    section80D: {
      claimed: claimed80D,
      allowed: allowed80D,
      limit: SECTION_80D_LIMITS.self + parentsLimit,
    },
    section80E: {
      claimed: claimed80E,
      allowed: allowed80E,
      limit: Number.POSITIVE_INFINITY,
    },
    section80G: {
      claimed: claimed80G,
      allowed: allowed80G,
      limit: qualifyingLimit,
    },
    total: round2(
      allowed80C + allowed80CCD1B + allowed80D + allowed80E + allowed80G,
    ),
  }
}

export const calculateTax = (data: TaxDataOptionType): TaxCalculationResult => {
  const regime = data.taxRegime

  const salary = num(data.salaryIncomeAnnually)
  const dividend = num(data.dividendIncomeAnnually)
  // Capital losses stay within the capital gains head (s.70/s.74): a
  // short-term loss can absorb short- or long-term gains, a long-term loss
  // only long-term gains. Crypto losses cannot be set off at all (s.115BBH).
  const rawLtcg = num(data.longTermCapitalGainAnnually)
  const rawStcg = num(data.shortTermCapitalGainAnnually)
  const stcg = atLeastZero(rawStcg)
  const ltcg = atLeastZero(rawLtcg + Math.min(rawStcg, 0))
  const crypto = atLeastZero(num(data.cryptoGainIncomeAnnually))

  // Intraday is speculative business income and F&O is non-speculative
  // business income, but both are ultimately taxed at slab rates.
  const businessIncome =
    num(data.intradayTradingIncomeAnnually) +
    num(data.equityFnoTradingIncomeAnnually) +
    num(data.commodityFnoTradingIncomeAnnually)

  const otherSlabIncome =
    dividend +
    num(data.fdInterestIncomeAnnually) +
    businessIncome +
    num(data.otherIncomeAnnually)

  const grossTotalIncome = round2(
    salary + otherSlabIncome + ltcg + stcg + crypto,
  )

  // Section 10(13A) is an exemption rather than a deduction, so it comes off
  // salary before anything else — including the standard deduction, which
  // applies to what is left of the salary head.
  const hra = computeHra(data, regime, salary)
  const salaryAfterExemption = atLeastZero(round2(salary - hra.exempt))

  // The standard deduction is only available against salary income.
  const standardDeduction = Math.min(
    salaryAfterExemption,
    STANDARD_DEDUCTION[regime],
  )

  /*
   * Section 37: the cost of earning the trading income — brokerage, exchange
   * and demat charges, the GST charged on them, data subscriptions. This is a
   * business expense rather than a chapter VI-A deduction, so unlike
   * everything below it the new regime allows it too.
   *
   * Capped at the business income itself. A business loss cannot be set
   * against salary (s.71(2A)) and losses are not modelled here, so letting
   * expenses run past the income they belong to would only overstate relief.
   */
  const claimedExpenses = atLeastZero(num(data.businessExpensesAnnually))
  const expenseLimit = atLeastZero(businessIncome)
  const businessExpenses: DeductionSummary = {
    claimed: claimedExpenses,
    allowed: Math.min(claimedExpenses, expenseLimit),
    limit: expenseLimit,
  }

  // Section 24(b): interest on a self-occupied house is a loss under the
  // house-property head, set off against the rest of your income. The new
  // regime allows neither the deduction nor the set-off (s.115BAC).
  const claimedHomeLoan = atLeastZero(num(data.homeLoanInterestAnnually))
  const homeLoanLimit = regime === 'old' ? HOME_LOAN_INTEREST_LIMIT : 0
  const homeLoanInterest: DeductionSummary = {
    claimed: claimedHomeLoan,
    allowed: Math.min(claimedHomeLoan, homeLoanLimit),
    limit: homeLoanLimit,
  }

  const incomeBeforeChapterVIA = atLeastZero(
    round2(
      salaryAfterExemption -
        standardDeduction +
        otherSlabIncome -
        businessExpenses.allowed -
        homeLoanInterest.allowed,
    ),
  )

  const deductions = computeDeductions(data, regime, incomeBeforeChapterVIA)

  const slabIncome = atLeastZero(
    round2(incomeBeforeChapterVIA - deductions.total),
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
    hra,
    standardDeduction,
    businessExpenses,
    homeLoanInterest,
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
