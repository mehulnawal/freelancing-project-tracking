import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { subscribeClients } from '../services/clients'
import { subscribeProjects } from '../services/projects'
import { subscribeExpenses, subscribeRecurringTemplates } from '../services/expenses'
import { subscribeIncome } from '../services/financial'

const useSub = (subscribe) => {
  const { user, isConfigured, preview } = useAuth()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(user && isConfigured && !preview))
  const active = Boolean(user && isConfigured && !preview)

  useEffect(() => {
    if (!active) return undefined
    return subscribe(user.uid, (next) => {
      setItems(next)
      setError('')
      setLoading(false)
    }, () => {
      setError('A dashboard source could not be loaded.')
      setLoading(false)
    })
  }, [active, user, subscribe])

  return { items: active ? items : [], error: active ? error : '', loading: active ? loading : false }
}

export function useDashboardData() {
  const clients = useSub(subscribeClients)
  const projects = useSub(subscribeProjects)
  const expenses = useSub(subscribeExpenses)
  const income = useSub(subscribeIncome)
  const templates = useSub(subscribeRecurringTemplates)
  return { clients, projects, expenses, income, templates, loading: [clients, projects, expenses, income, templates].some((item) => item.loading), errors: [clients, projects, expenses, income, templates].filter((item) => item.error).map((item) => item.error) }
}


