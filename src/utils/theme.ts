import { THEME_STORAGE_KEY } from '../constants/common'
import type { Theme } from '../interfaces/common'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark'

/** The OS preference, falling back to light where matchMedia is unavailable. */
export const getSystemTheme = (): Theme =>
  window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'

export const watchSystemTheme = (onChange: (theme: Theme) => void) => {
  const query = window.matchMedia?.(DARK_QUERY)
  if (!query) return () => {}

  const listener = (event: MediaQueryListEvent) =>
    onChange(event.matches ? 'dark' : 'light')

  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/**
 * The stored choice, or null when the user has never picked one — the caller
 * treats null as "keep following the OS". Storage can throw in private
 * browsing or when cookies are blocked, which is not worth failing over.
 */
export const readStoredTheme = (): Theme | null => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : null
  } catch {
    // Storage unavailable; fall back to the system preference.
    return null
  }
}

export const writeStoredTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable; the theme still applies for this session.
  }
}

/** Mirrors the theme onto <html data-theme>, which is what the CSS keys off. */
export const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
}

/** Fires when another tab changes the stored theme. */
export const watchStoredTheme = (onChange: (theme: Theme | null) => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    onChange(isTheme(event.newValue) ? event.newValue : null)
  }

  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
