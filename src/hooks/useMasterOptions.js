import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { rtdb } from '../config/firebase'
import { useAuth } from '../context/useAuth'

export function useMasterOptions(group, activeOnly = true) {
  const { user, isConfigured, preview } = useAuth()
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(Boolean(user && isConfigured && !preview))
  const [error, setError] = useState('')
  useEffect(() => {
    if (!user || !isConfigured || preview || !rtdb) return undefined
    return onValue(ref(rtdb, `users/${user.uid}/masterOptions`), (snapshot) => {
      const next = Object.entries(snapshot.val() || {}).map(([id, item]) => ({ id, ...item })).filter((item) => item.group === group && (!activeOnly || item.isActive !== false)).sort((left, right) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER) || left.label.localeCompare(right.label))
      setOptions(next)
      setLoading(false)
    }, (snapshotError) => {
      console.error('Unable to load master options:', snapshotError)
      setError('Options could not be loaded.')
      setLoading(false)
    })
  }, [group, activeOnly, user, isConfigured, preview])
  return { options, loading, error }
}
