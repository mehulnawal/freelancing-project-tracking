import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from './useAuth'
import { saveGlobalSettings } from '../services/firestore'
import { DEFAULT_SETTINGS, SettingsContext } from './settingsStore'
export function SettingsProvider({ children }) { const { user, isConfigured, preview } = useAuth(); const [settings, setSettings] = useState(DEFAULT_SETTINGS); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  useEffect(() => { if (!user || !isConfigured || preview) return undefined; return onSnapshot(doc(db, 'appSettings', 'global'), (snapshot) => { setSettings({ ...DEFAULT_SETTINGS, ...(snapshot.data() || {}) }); setLoading(false) }, () => { setError('Settings could not be loaded.'); setLoading(false) }) }, [user, isConfigured, preview])
  useEffect(() => { document.title = settings.brandName; if (settings.accentColor) document.documentElement.style.setProperty('--brand', settings.accentColor); else document.documentElement.style.removeProperty('--brand'); const icon = document.querySelector('link[rel="icon"]'); if (icon && settings.faviconUrl) icon.href = settings.faviconUrl }, [settings])
  const save = useCallback(async (values) => { if (!user || !isConfigured || preview) throw new Error('Settings are read-only until Firebase is configured.'); setError(''); await saveGlobalSettings(user.uid, values); return true }, [user, isConfigured, preview])
  return <SettingsContext.Provider value={useMemo(() => ({ settings, loading, error, save, readOnly: !user || !isConfigured || preview }), [settings, loading, error, save, user, isConfigured, preview])}>{children}</SettingsContext.Provider> }
