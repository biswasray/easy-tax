import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so
// built assets need that prefix or they 404. Set VITE_BASE to '/' if you move
// the site to a custom domain or a <user>.github.io repository.
const base = process.env.VITE_BASE ?? '/easy-tax/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // The dev server always serves from the root; only the build needs the prefix.
  base: command === 'build' ? base : '/',
}))
