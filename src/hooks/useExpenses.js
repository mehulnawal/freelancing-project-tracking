import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { subscribeExpenses } from '../services/expenses'

export function useExpenses() {
  const { user, isConfigured, preview } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(user && isConfigured && !preview))
  const [error, setError] = useState('')
  const active = Boolean(user && isConfigured && !preview)

  useEffect(() => {
    if (!active) return undefined
    return subscribeExpenses(user.uid, (next) => {
      setItems(next)
      setLoading(false)
      setError('')
    }, () => {
      setError('Expenses could not be loaded.')
      setLoading(false)
    })
  }, [active, user])

  return { items: active ? items : [], loading: active ? loading : false, error: active ? error : '' }
}


