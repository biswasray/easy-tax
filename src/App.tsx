import { useMemo, useState } from 'react'
import { ThemeToggle } from './components'
import {
  DEDUCTION_GROUP,
  EMPTY_FORM,
  FIELD_KEYS,
  INCOME_GROUPS,
  REGIME_LABEL,
  REGIME_OPTIONS,
} from './constants'
import type { AmountField, FieldConfig, FormState } from './interfaces'
import {
  buildBreakdown,
  calculateTax,
  DEDUCTION_LIMITS,
  formatCurrency,
  formatInputValue,
  formatPercent,
  formatRate,
  parseInputValue,
  slabLabel,
  type TaxRegime,
} from './utils'
import logo from './assets/logo.svg'
import './App.css'

function App() {
  const [regime, setRegime] = useState<TaxRegime>('new')
  const [seniorParents, setSeniorParents] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

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
