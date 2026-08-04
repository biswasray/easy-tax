import { useMemo, useState } from 'react'
import { ThemeToggle } from './components'
import {
  DEDUCTION_GROUPS,
  EMPTY_FLAGS,
  EMPTY_FORM,
  FIELD_KEYS,
  INCOME_GROUPS,
  REGIME_LABEL,
  REGIME_OPTIONS,
} from './constants'
import type {
  AmountField,
  FieldConfig,
  FieldGroup,
  FlagState,
  FormState,
} from './interfaces'
import {
  buildBreakdown,
  calculateTax,
  formatCurrency,
  formatInputValue,
  formatFinancialYear,
  formatPercent,
  formatRate,
  formatTaxYear,
  getFinancialYearStart,
  parseInputValue,
  RATE_FINANCIAL_YEAR_START,
  slabLabel,
  type TaxRegime,
} from './utils'
import logo from './assets/logo.svg'
import './App.css'

/** Read once per mount: the year only turns over on 1 April. */
const currentFinancialYear = getFinancialYearStart()

function App() {
  const [regime, setRegime] = useState<TaxRegime>('new')
  const [flags, setFlags] = useState<FlagState>(EMPTY_FLAGS)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const amounts = useMemo(() => {
    const parsed = {} as Record<AmountField, number>
    for (const key of FIELD_KEYS) {
      const value = Number(form[key])
      parsed[key] = Number.isFinite(value) ? value : 0
    }
    return parsed
  }, [form])

  const input = useMemo(() => ({ ...amounts, ...flags }), [amounts, flags])

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
  // What the new regime turns away: HRA, chapter VI-A and the 24(b) interest.
  // Taken from the old-regime run rather than from what was typed, so the
  // figure is what you would actually be allowed, not what you claimed.
  const forgoneDeductions =
    regime === 'new'
      ? alternate.hra.exempt +
        alternate.deductions.total +
        alternate.homeLoanInterest.allowed
      : 0

  const updateField = (field: FieldConfig, value: string) => {
    setForm((current) => ({
      ...current,
      [field.key]: parseInputValue(value, field.allowNegative ?? false),
    }))
  }

  /** A group's fields are live unless the group is scoped to the other regime. */
  const isActive = (group: FieldGroup) =>
    group.regimes === undefined || group.regimes.includes(regime)

  const renderField = (field: FieldConfig, active = true) => {
    // A cap is only worth showing where the field does something. Where the
    // regime disallows it outright, a limit would contradict the note.
    const limit = active ? field.getLimit?.({ flags, result }) : undefined
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
              ? `${formatCurrency(excess)} over the ${formatCurrency(limit)} ${field.limitLabel ?? 'limit'} is not counted.`
              : field.limitLabel
                ? `Capped at your ${formatCurrency(limit)} ${field.limitLabel}.`
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
            Income-tax estimate for a resident individual under 60,{' '}
            {formatTaxYear(RATE_FINANCIAL_YEAR_START)}.
          </p>
          {currentFinancialYear > RATE_FINANCIAL_YEAR_START && (
            <p className="year-note">
              Today falls in {formatFinancialYear(currentFinancialYear)}, whose
              rates are not in this build yet.
            </p>
          )}
        </div>
        <div className="header-controls">
          <fieldset className="regime-toggle">
            <legend className="visually-hidden">Tax regime</legend>
            {REGIME_OPTIONS.map((option) => (
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
          <ThemeToggle />
        </div>
      </header>

      <div className="layout">
        <form
          className="income-form"
          onSubmit={(event) => event.preventDefault()}
        >
          {INCOME_GROUPS.map((group) => (
            <fieldset key={group.title} className="income-group">
              <legend>{group.title}</legend>
              {/* Not point-free: map would pass the index as `active`. */}
              {group.fields.map((field) => renderField(field))}
            </fieldset>
          ))}

          {DEDUCTION_GROUPS.map((group) => {
            const active = isActive(group)

            return (
              <fieldset
                key={group.title}
                className={`income-group deduction-group${
                  active ? '' : ' is-inactive'
                }`}
              >
                <legend>{group.title}</legend>
                {group.note && (
                  <p className="group-note">{group.note[regime]}</p>
                )}
                {group.fields.map((field) => renderField(field, active))}
                {group.toggles?.map((toggle) => (
                  <label key={toggle.key} className="checkbox">
                    <input
                      type="checkbox"
                      checked={flags[toggle.key]}
                      onChange={(event) =>
                        setFlags((current) => ({
                          ...current,
                          [toggle.key]: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      {toggle.label}
                      <span className="hint">{toggle.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )
          })}

          <button
            type="button"
            className="reset"
            onClick={() => {
              setForm(EMPTY_FORM)
              setFlags(EMPTY_FLAGS)
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
              {hasIncome ? '' : ' · enter your income to begin'}
            </p>
            {hasIncome && (
              <div className="effective-rate">
                <span>
                  Effective tax rate
                  <small>
                    of {formatCurrency(result.grossTotalIncome)} gross
                  </small>
                </span>
                <strong>{formatPercent(result.effectiveTaxRate)}</strong>
              </div>
            )}
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
              {formatCurrency(forgoneDeductions)} of exemptions and deductions
              is being ignored because the new regime allows none of HRA,
              chapter VI-A or the home-loan interest. Business expenses still
              count.
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
            {result.hra.exempt > 0 && (
              <p className="footnote">
                The HRA exemption is the least of{' '}
                {formatCurrency(result.hra.tests.received)} received,{' '}
                {formatCurrency(result.hra.tests.salaryShare)} (
                {formatRate(result.hra.salaryShareRate)} of basic salary) and{' '}
                {formatCurrency(result.hra.tests.rentOverThreshold)} of rent
                paid over 10% of basic.
              </p>
            )}
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
          An estimate only — HRA, LTA, NPS, let-out property, senior-citizen
          slabs and loss carry-forward are not modelled. Check with a tax
          professional before you file.
        </p>
      </footer>
    </div>
  )
}

export default App
