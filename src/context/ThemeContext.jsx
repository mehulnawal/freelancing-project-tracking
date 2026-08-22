import { useEffect, useState } from 'react'
import { ThemeContext } from './themeStore'
const getInitialTheme = () => localStorage.getItem('fm-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0D1117' : '#F6F7FB')
    localStorage.setItem('fm-theme', theme)
  }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((value) => value === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>
}
