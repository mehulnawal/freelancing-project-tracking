import { useContext } from 'react'
import { SettingsContext } from './settingsStore'
export const useSettings = () => useContext(SettingsContext)
