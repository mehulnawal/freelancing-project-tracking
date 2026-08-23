import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { subscribeClients } from '../services/clients'
import { subscribeProjects } from '../services/projects'
import { subscribeAccounts } from '../services/financial'

function useCollection(subscribe) {
  const { user, isConfigured, preview } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(user && isConfigured && !preview))
  const [error, setError] = useState('')
  const active = Boolean(user && isConfigured && !preview)

  useEffect(() => {
    if (!active) return undefined
    return subscribe(user.uid, (next) => {
      setItems(next)
      setError('')
      setLoading(false)
    }, () => {
      setError('Data could not be loaded.')
      setLoading(false)
    })
  }, [active, user, subscribe])

  return { items: active ? items : [], loading: active ? loading : false, error: active ? error : '' }
}
export const useClients = () => useCollection(subscribeClients)
export const useProjects = () => useCollection(subscribeProjects)
export const useAccounts = () => useCollection(subscribeAccounts)


