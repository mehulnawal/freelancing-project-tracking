import { describe, expect, it } from 'vitest'
import { clientDuplicateReason, normalizeEmail, normalizeName, normalizePhone } from './normalization'

describe('normalization', () => {
  it('normalizes names, email addresses, and Indian phone numbers', () => {
    expect(normalizeName('  Acme   Studio ')).toBe('acme studio')
    expect(normalizeEmail(' USER@Example.COM ')).toBe('user@example.com')
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210')
  })

  it('detects strong client contact duplicates but allows same names with distinct contacts', () => {
    const clients = { c1: { name: 'Acme Studio', email: 'hello@acme.test', mobile: '9876543210', status: 'Active' } }
    expect(clientDuplicateReason(clients, { name: 'Other', email: 'HELLO@ACME.TEST' })).toMatch(/email/i)
    expect(clientDuplicateReason(clients, { name: 'Acme Studio', email: 'other@acme.test' })).toBeNull()
  })
})

