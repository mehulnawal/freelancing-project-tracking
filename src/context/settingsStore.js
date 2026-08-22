import { createContext } from 'react'

export const DEFAULT_SETTINGS = { brandName: 'Freelance Manager', shortName: 'FM', tagline: '', businessEmail: '', businessPhone: '', businessWebsite: '', reportFooter: '', logoUrl: '', darkLogoUrl: '', faviconUrl: '', accentColor: '', currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata', dateFormat: 'dd MMM yyyy', financialYearStart: 'April', firstDayOfWeek: 'Monday', pageSize: 25, inactivityMinutes: 60, defaultTheme: 'system', density: 'comfortable', reducedMotion: false, sidebarCollapsed: false }
export const SettingsContext = createContext(null)
