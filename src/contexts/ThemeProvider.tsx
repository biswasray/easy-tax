import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Theme, ThemeContextValue } from '../interfaces'
import {
  applyTheme,
  getSystemTheme,
  readStoredTheme,
  watchStoredTheme,
  watchSystemTheme,
  writeStoredTheme,
} from '../utils'
import { ThemeContext } from './theme-context'

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // An explicit choice, or null while the OS preference is still in charge.
  const [storedTheme, setStoredTheme] = useState<Theme | null>(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme)

  const theme = storedTheme ?? systemTheme

  // Track the OS so an untouched app follows it live, not just on first load.
  useEffect(() => watchSystemTheme(setSystemTheme), [])

  // Keep other tabs in step, since they share the same stored value.
  useEffect(() => watchStoredTheme(setStoredTheme), [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setStoredTheme(next)
    writeStoredTheme(next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      isSystemTheme: storedTheme === null,
    }),
    [theme, setTheme, storedTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
