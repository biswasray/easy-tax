#!/usr/bin/env node
/**
 * Fills the generated regions of README.md.
 *
 * Markdown cannot compute anything at render time, so the dynamic bits are
 * written in by this script and checked in. Run `yarn sync:readme` to update,
 * or `yarn sync:readme --check` to fail when the file has drifted (CI does).
 *
 * Two regions, from deliberately different sources:
 *  - tax-year   follows RATE_FINANCIAL_YEAR_START, so the README always names
 *               the year the rates actually implement, never the wall clock.
 *  - copyright  follows the wall clock, which is what a copyright line means.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readmePath = join(root, 'README.md')
const taxPath = join(root, 'src', 'utils', 'tax.ts')

const readRateYear = () => {
  const source = readFileSync(taxPath, 'utf8')
  const match = source.match(/RATE_FINANCIAL_YEAR_START\s*=\s*(\d{4})/)

  if (!match) {
    throw new Error(
      `Could not read RATE_FINANCIAL_YEAR_START from ${taxPath}. ` +
        'Has the constant been renamed?',
    )
  }

  return Number(match[1])
}

// Mirrors src/utils/financialYear.ts, which is the source of truth for the app
// itself. Kept as a copy because this script runs on plain node, before any
// build step exists to import TypeScript from.
const span = (startYear) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`

const taxYear = (startYear) =>
  `FY ${span(startYear)} (AY ${span(startYear + 1)})`

// Markers must sit mid-line: a line-initial HTML comment is an HTML block, and
// Prettier will split the paragraph around it.
const REGIONS = {
  'tax-year': () => `**${taxYear(readRateYear())}**`,
  copyright: () => String(new Date().getFullYear()),
}

const fill = (markdown) =>
  Object.entries(REGIONS).reduce((text, [name, resolve]) => {
    const region = new RegExp(
      `(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`,
    )

    if (!region.test(text)) {
      throw new Error(
        `README.md is missing the <!-- ${name}:start --> … <!-- ${name}:end --> markers.`,
      )
    }

    return text.replace(region, `$1${resolve()}$2`)
  }, markdown)

const current = readFileSync(readmePath, 'utf8')
const next = fill(current)

if (current === next) {
  console.log('README.md is up to date.')
} else if (process.argv.includes('--check')) {
  console.error('README.md is out of date. Run `yarn sync:readme`.')
  process.exit(1)
} else {
  writeFileSync(readmePath, next)
  console.log('README.md updated.')
}
