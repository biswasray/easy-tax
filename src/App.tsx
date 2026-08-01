import { useMemo, useState } from 'react'
import {
  calculateTax,
  DEDUCTION_LIMITS,
  type TaxCalculationResult,
  type TaxDataOptionType,
  type TaxRegime,
} from './utils'
import logo from './assets/logo.svg'
import './App.css'

/** Every amount field, i.e. everything except the regime and the age flag. */
type AmountField = {
  [K in keyof TaxDataOptionType]-?: TaxDataOptionType[K] extends
    number | undefined
    ? K
    : never
}[keyof TaxDataOptionType]

type FieldConfig = {
  key: AmountField
  label: string
  /** How this bucket is taxed, shown under the input. */
  hint: string
  /** Business/other income can be a loss and set off against other income. */
  allowNegative?: boolean
  /** Statutory ceiling, for deduction fields. */
  getLimit?: (seniorParents: boolean) => number
}

const INCOME_GROUPS: { title: string; fields: FieldConfig[] }[] = [
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

const DEDUCTION_GROUP: { title: string; fields: FieldConfig[] } = {
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

const FIELD_KEYS = ALL_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key),
)

const EMPTY_FORM = Object.fromEntries(
  FIELD_KEYS.map((key) => [key, '']),
) as Record<AmountField, string>

const REGIME_LABEL: Record<TaxRegime, string> = {
  new: 'New regime',
  old: 'Old regime',
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const groupFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
})

const formatCurrency = (value: number) =>
  currencyFormatter.format(Math.round(value))

const formatPercent = (fraction: number) =>
  `${(fraction * 100).toFixed(fraction >= 0.1 ? 1 : 2)}%`

const formatRate = (rate: number) => `${Math.round(rate * 100)}%`

/** Groups the digits the user has typed, e.g. "1200000" -> "12,00,000". */
const formatInputValue = (raw: string) => {
  if (raw === '' || raw === '-') return raw
  const negative = raw.startsWith('-')
  const digits = negative ? raw.slice(1) : raw
  return `${negative ? '-' : ''}${groupFormatter.format(Number(digits))}`
}

const parseInputValue = (input: string, allowNegative: boolean) => {
  const negative = allowNegative && input.trimStart().startsWith('-')
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (digits === '') return negative ? '-' : ''
  return `${negative ? '-' : ''}${digits}`
}

const slabLabel = (from: number, to: number | null) => {
  if (to === null) return `Above ${formatCurrency(from)}`
  if (from === 0) return `Up to ${formatCurrency(to)}`
  return `${formatCurrency(from)} – ${formatCurrency(to)}`
}

type BreakdownRow = {
  label: string
  value: number
  /** Shown as a subtraction, e.g. the standard deduction. */
  negative?: boolean
  /** Rows that are only meaningful when non-zero. */
  hideWhenZero?: boolean
  emphasis?: boolean
  note?: string
}

const buildBreakdown = (result: TaxCalculationResult): BreakdownRow[] => [
  { label: 'Gross total income', value: result.grossTotalIncome },
  {
    label: 'Standard deduction',
    value: result.standardDeduction,
    negative: true,
    hideWhenZero: true,
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
    label: 'Marginal relief',
    value: result.marginalRelief,
    negative: true,
    hideWhenZero: true,
  },
  {
    label: 'Health & education cess',
    value: result.cess,
    hideWhenZero: true,
    note: '4%',
  },
]

function App() {
  const [regime, setRegime] = useState<TaxRegime>('new')
  const [seniorParents, setSeniorParents] = useState(false)
  const [form, setForm] = useState<Record<AmountField, string>>(EMPTY_FORM)

  const amounts = useMemo(() => {
    const parsed = {} as Record<AmountField, number>
    for (const key of FIELD_KEYS) {
      const value = Number(form[key])
      parsed[key] = Number.isFinite(value) ? value : 0
    }
    return parsed
  }, [form])

  const input = useMemo(
    () => ({ ...amounts, parentsAreSeniorCitizens: seniorParents }),
    [amounts, seniorParents],
  )

  const result = useMemo(
    () => calculateTax({ ...input, taxRegime: regime }),
    [input, regime],
  )

  const alternateRegime: TaxRegime = regime === 'new' ? 'old' : 'new'
  const alternate = useMemo(
    () => calculateTax({ ...input, taxRegime: alternateRegime }),
    [input, alternateRegime],
  )

  const hasIncome = result.grossTotalIncome > 0
  const saving = alternate.totalTaxPayable - result.totalTaxPayable
  const breakdown = buildBreakdown(result)
  const { section80C, section80D } = result.deductions
  const forgoneDeductions =
    regime === 'new' ? section80C.claimed + section80D.claimed : 0

  const updateField = (field: FieldConfig, value: string) => {
    setForm((current) => ({
      ...current,
      [field.key]: parseInputValue(value, field.allowNegative ?? false),
    }))
  }

  const renderField = (field: FieldConfig) => {
    // Caps are only worth showing in the old regime. Under the new regime the
    // section is disallowed outright, so a limit would contradict the note.
    const limit = regime === 'old' ? field.getLimit?.(seniorParents) : undefined
    const excess = limit === undefined ? undefined : amounts[field.key] - limit

    return (
      <div key={field.key} className="field">
        <label htmlFor={field.key}>{field.label}</label>
        <div className="input-wrap">
          <span aria-hidden="true">₹</span>
          <input
            id={field.key}
            name={field.key}
            type="text"
            inputMode={field.allowNegative ? 'text' : 'numeric'}
            autoComplete="off"
            placeholder="0"
            value={formatInputValue(form[field.key])}
            onChange={(event) => updateField(field, event.target.value)}
          />
        </div>
        <p className="hint">{field.hint}</p>
        {limit !== undefined && (
          <p className={`limit${excess && excess > 0 ? ' is-exceeded' : ''}`}>
            {excess && excess > 0
              ? `${formatCurrency(excess)} over the ${formatCurrency(limit)} limit is not counted.`
              : `Limit ${formatCurrency(limit)}.`}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>
            <img className="logo" src={logo} alt="" width="40" height="40" />
            easy-tax
          </h1>
          <p>
            Income-tax estimate for a resident individual under 60, FY 2025-26
            (AY 2026-27).
          </p>
        </div>
        <fieldset className="regime-toggle">
          <legend className="visually-hidden">Tax regime</legend>
          {(['new', 'old'] as const).map((option) => (
            <label
              key={option}
              className={option === regime ? 'is-selected' : undefined}
            >
              <input
                type="radio"
                name="tax-regime"
                value={option}
                checked={option === regime}
                onChange={() => setRegime(option)}
              />
              {REGIME_LABEL[option]}
            </label>
          ))}
        </fieldset>
      </header>

      <div className="layout">
        <form
          className="income-form"
          onSubmit={(event) => event.preventDefault()}
        >
          {INCOME_GROUPS.map((group) => (
            <fieldset key={group.title} className="income-group">
              <legend>{group.title}</legend>
              {group.fields.map(renderField)}
            </fieldset>
          ))}

          <fieldset
            className={`income-group deduction-group${
              regime === 'new' ? ' is-inactive' : ''
            }`}
          >
            <legend>{DEDUCTION_GROUP.title}</legend>
            <p className="group-note">
              {regime === 'new'
                ? 'The new regime does not allow 80C or 80D. Anything you enter here is kept and applied the moment you switch to the old regime.'
                : 'Deductions reduce salary, interest and business income only — they cannot be set off against capital gains or crypto.'}
            </p>
            {DEDUCTION_GROUP.fields.map(renderField)}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={seniorParents}
                onChange={(event) => setSeniorParents(event.target.checked)}
              />
              <span>
                My parents are 60 or older
                <span className="hint">
                  Raises the 80D parents limit from{' '}
                  {formatCurrency(DEDUCTION_LIMITS.section80DParents)} to{' '}
                  {formatCurrency(DEDUCTION_LIMITS.section80DSeniorParents)}.
                </span>
              </span>
            </label>
          </fieldset>

          <button
            type="button"
            className="reset"
            onClick={() => {
              setForm(EMPTY_FORM)
              setSeniorParents(false)
            }}
          >
            Reset all
          </button>
        </form>

        <aside className="results">
          <div className="total-card">
            <p className="total-label">Total tax payable</p>
            <p className="total-value">
              {formatCurrency(result.totalTaxPayable)}
            </p>
            <p className="total-meta">
              {REGIME_LABEL[regime]}
              {hasIncome
                ? ` · ${formatPercent(result.effectiveTaxRate)} of gross income`
                : ' · enter your income to begin'}
            </p>
          </div>

          {hasIncome && saving !== 0 && (
            <button
              type="button"
              className={`compare ${saving > 0 ? 'is-better' : 'is-worse'}`}
              onClick={() => setRegime(alternateRegime)}
            >
              {saving > 0
                ? `You are on the cheaper regime — the ${REGIME_LABEL[
                    alternateRegime
                  ].toLowerCase()} would cost ${formatCurrency(saving)} more.`
                : `Switch to the ${REGIME_LABEL[
                    alternateRegime
                  ].toLowerCase()} and save ${formatCurrency(-saving)}.`}
            </button>
          )}

          {forgoneDeductions > 0 && (
            <p className="notice">
              {formatCurrency(forgoneDeductions)} of 80C and 80D deductions is
              being ignored because the new regime does not allow chapter VI-A.
            </p>
          )}

          <section className="panel">
            <h2>Breakdown</h2>
            <dl className="breakdown">
              {breakdown
                .filter((row) => !row.hideWhenZero || row.value !== 0)
                .map((row) => (
                  <div
                    key={row.label}
                    className={row.emphasis ? 'is-emphasis' : undefined}
                  >
                    <dt>
                      {row.label}
                      {row.note && <span className="note">{row.note}</span>}
                    </dt>
                    <dd>
                      {row.negative ? '− ' : ''}
                      {formatCurrency(row.value)}
                    </dd>
                  </div>
                ))}
              <div className="is-total">
                <dt>Total tax payable</dt>
                <dd>{formatCurrency(result.totalTaxPayable)}</dd>
              </div>
            </dl>
            {result.basicExemptionUsedAgainstSpecialIncome > 0 && (
              <p className="footnote">
                {formatCurrency(result.basicExemptionUsedAgainstSpecialIncome)}{' '}
                of unused basic exemption was set off against your capital
                gains.
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Slab rates</h2>
            <table className="slabs">
              <thead>
                <tr>
                  <th scope="col">Slab</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Taxable</th>
                  <th scope="col">Tax</th>
                </tr>
              </thead>
              <tbody>
                {result.slabs.map((slab) => (
                  <tr
                    key={slab.from}
                    className={slab.taxableAmount > 0 ? undefined : 'is-empty'}
                  >
                    <th scope="row">{slabLabel(slab.from, slab.to)}</th>
                    <td>{formatRate(slab.rate)}</td>
                    <td>{formatCurrency(slab.taxableAmount)}</td>
                    <td>{formatCurrency(slab.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="footnote">
              Slab rates apply to salary, interest, dividend, business and other
              income. Capital gains and crypto are taxed at their own rates.
            </p>
          </section>
        </aside>
      </div>

      <footer className="app-footer">
        <p>
          An estimate only — chapter VI-A deductions, senior-citizen slabs and
          loss carry-forward are not modelled. Check with a tax professional
          before you file.
        </p>
      </footer>
    </div>
  )
}

export default App
