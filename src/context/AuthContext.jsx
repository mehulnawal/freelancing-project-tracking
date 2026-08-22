import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, isDevelopmentPreview, isFirebaseConfigured } from '../config/firebase'
import * as authService from '../services/auth'
import { AuthContext } from './authStore'
export function AuthProvider({ children }) { const [user, setUser] = useState(null); const [loading, setLoading] = useState(isFirebaseConfigured); const [unauthorized, setUnauthorized] = useState(false); const adminUid = import.meta.env.VITE_ADMIN_UID
  useEffect(() => { if (!isFirebaseConfigured) return undefined; return onAuthStateChanged(auth, async (next) => { if (next && next.uid !== adminUid) { setUnauthorized(true); await authService.logout(); setUser(null) } else { setUnauthorized(false); setUser(next) } setLoading(false) }) }, [adminUid])
  const value = useMemo(() => ({ user, loading, unauthorized, isConfigured: isFirebaseConfigured, preview: isDevelopmentPreview, isAdmin: Boolean(user && user.uid === adminUid), ...authService }), [user, loading, unauthorized, adminUid])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider> }
