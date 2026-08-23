export function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function normalizeName(value) {
  return normalizeText(value)
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
}

export function clientDuplicateReason(clients, candidate, excludeId) {
  const name = normalizeName(candidate.name)
  const email = normalizeEmail(candidate.email)
  const mobile = normalizePhone(candidate.mobile || candidate.phone)
  for (const [id, client] of Object.entries(clients || {})) {
    if (!client || id === excludeId || client.isDeleted || client.status === 'Archived') continue
    const existingEmail = normalizeEmail(client.email)
    const existingMobile = normalizePhone(client.mobile || client.phone)
    if (email && existingEmail === email) return 'A client with this email already exists.'
    if (mobile && existingMobile === mobile) return 'A client with this phone number already exists.'
    const sameName = name && normalizeName(client.name) === name
    if (sameName && !email && !mobile && !existingEmail && !existingMobile) return 'A client with this name already exists.'
  }
  return null
}

