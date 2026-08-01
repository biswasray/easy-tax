import { createContext } from 'react'
import type { ThemeContextValue } from '../interfaces'

/**
 * Null until a provider is mounted, which lets useTheme fail loudly rather
 * than silently handing back a default theme that nothing is driving.
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null)
