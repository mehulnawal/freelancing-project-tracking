import { toMinorUnits } from './money'
import { normalizeName } from './normalization'

export const IMPORT_SCHEMAS = {
  Clients: ['Name', 'Email', 'Phone', 'Client Type', 'Status'],
  Projects: ['Name', 'Client ID', 'Project Type', 'Status', 'Currency', 'Total Amount', 'Start Date'],
  Income: ['Title', 'Amount', 'Account ID', 'Currency', 'Received Date', 'Income Category', 'Payment Mode', 'Source Type', 'Project ID', 'Client ID', 'Payment Type'],
  Expenses: ['Title', 'Amount', 'Currency', 'Expense Type', 'Category', 'Expense Date', 'Payment Status', 'Account ID', 'Payment Mode', 'Paid Date', 'Project ID', 'Client ID'],
  Accounts: ['Name', 'Account Type', 'Currency', 'Opening Balance', 'Status'],
}

const key = (value) => String(value || '').trim()
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(key(value)) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())

export function validateImport(type, rows, existing = {}) {
  const required = IMPORT_SCHEMAS[type] || []
  const errors = []
  const valid = []
  const names = new Set((existing[type] || []).map((item) => normalizeName(item.name)))
  rows.forEach((raw, index) => {
    const row = Object.fromEntries(Object.entries(raw).map(([field, value]) => [field.trim(), key(value)]))
    const issues = []
    required.forEach((field) => {
      if (['Email', 'Phone', 'Project ID', 'Client ID', 'Payment Type', 'Paid Date'].includes(field)) return
      if (!row[field]) issues.push(`${field} is required`)
    })
    if (row.Amount && (!/^\d+(\.\d{1,2})?$/.test(row.Amount) || toMinorUnits(row.Amount) <= 0)) issues.push('Amount must be a positive monetary value')
    ;['Start Date', 'Received Date', 'Expense Date', 'Paid Date'].forEach((field) => {
      if (row[field] && !validDate(row[field])) issues.push(`${field} must use YYYY-MM-DD`)
    })
    if (type === 'Clients' && row.Name && names.has(normalizeName(row.Name))) issues.push('Duplicate client name')
    if (type === 'Projects' && row['Client ID'] && !existing.clientIds?.has(row['Client ID'])) issues.push('Client ID does not exist')
    if (['Income', 'Expenses'].includes(type) && row['Account ID'] && !existing.accountIds?.has(row['Account ID'])) issues.push('Account ID does not exist')
    if (['Income', 'Expenses'].includes(type) && row['Project ID'] && !existing.projectIds?.has(row['Project ID'])) issues.push('Project ID does not exist')
    if (issues.length) errors.push({ row: index + 2, reasons: issues })
    else {
      valid.push(row)
      if (type === 'Clients') names.add(normalizeName(row.Name))
    }
  })
  return { valid, errors, total: rows.length }
}

export const safeExportFilename = (type, format) => `${key(type).replace(/[^a-z0-9]+/gi, '_')}_Export_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${format}`

