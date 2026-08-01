import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so
// built assets need that prefix or they 404. Set VITE_BASE to '/' if you move
// the site to a custom domain or a <user>.github.io repository.
const base = process.env.VITE_BASE ?? '/easy-tax/'

/**
 * Publishes the package version alongside the site. CI fetches this file from
 * the live deployment and only deploys when package.json has overtaken it.
 */
const emitVersion = (): Plugin => ({
  name: 'emit-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify({ version }, null, 2)}\n`,
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), emitVersion()],
  // The dev server always serves from the root; only the build needs the prefix.
  base: command === 'build' ? base : '/',
}))
