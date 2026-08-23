let xlsxLoader; let pdfLoader; const loadXlsx = () => xlsxLoader ||= import('xlsx'); const loadPdf = () => pdfLoader ||= import('jspdf');
import { get, ref } from 'firebase/database'
import { rtdb } from '../config/firebase'
import { csvText } from '../utils/csv'
import { toMinorUnits, formatCurrency } from '../utils/money'
import { IMPORT_SCHEMAS, safeExportFilename } from '../utils/importValidation'
import { createClient } from './clients'
import { createProject } from './projects'
import { createAccount, createIncome } from './financial'
import { createExpense } from './expenses'

export const DATA_TYPES = Object.keys(IMPORT_SCHEMAS)
export { safeExportFilename, validateImport } from '../utils/importValidation'
export const templateRows = (type) => [IMPORT_SCHEMAS[type] || []]

export async function parseRows(file, text) {
  const XLSX = await loadXlsx()
  if (/\.xlsx$/i.test(file.name)) {
    const book = XLSX.read(text, { type: 'array' })
    return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' })
  }
  const content = new TextDecoder().decode(text).replace(/^\uFEFF/, '')
  const book = XLSX.read(new TextEncoder().encode(content), { type: 'array' })
  return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' })
}
const recordRows = (type, records, lookups, settings) => records.map((item) => { const amount = item.amountMinor === undefined ? '' : formatCurrency(item.amountMinor, item.currency || settings.currency, settings.locale); if (type === 'Clients') return { ID: item.id, Name: item.name, Email: item.email || '', Phone: item.phone || '', Status: item.status || '', 'Client Type': item.clientTypeId || '' }; if (type === 'Projects') return { ID: item.id, Name: item.name, 'Client ID': item.clientId, Client: lookups.clients[item.clientId]?.name || '', Status: item.status, Currency: item.currency || '', 'Total Amount': amount, 'Start Date': String(item.startDate || '').slice(0, 10) }; if (type === 'Accounts') return { ID: item.id, Name: item.name, Currency: item.currency, Status: item.status, 'Opening Balance': formatCurrency(item.openingBalanceMinor || 0, item.currency, settings.locale), 'Current Balance': formatCurrency(item.currentBalanceMinor || 0, item.currency, settings.locale) }; return { ID: item.id, Title: item.title, Amount: amount, Currency: item.currency, Status: item.status || item.paymentStatus, 'Project ID': item.projectId || '', Project: lookups.projects[item.projectId]?.name || '', 'Client ID': item.clientId || '', Date: String(item.receivedDate || item.expenseDate || '').slice(0, 10) } })
export async function loadExportData(uid, type, settings) { const collectionName = { Clients: 'clients', Projects: 'projects', Income: 'income', Expenses: 'expenses', Accounts: 'accounts' }[type]; const [records, clients, projects] = await Promise.all([get(ref(rtdb, `users/${uid}/${collectionName}`)), get(ref(rtdb, `users/${uid}/clients`)), get(ref(rtdb, `users/${uid}/projects`))]); const rows = Object.entries(records.val() || {}).map(([id, data]) => ({ id, ...data })); const clientMap = Object.fromEntries(Object.entries(clients.val() || {})); const projectMap = Object.fromEntries(Object.entries(projects.val() || {})); return recordRows(type, rows, { clients: clientMap, projects: projectMap }, settings) }
export async function downloadExport(type, format, rows) { const XLSX = format === 'csv' ? null : await loadXlsx(); const filename = safeExportFilename(type, format); if (format === 'csv') { const headers = Object.keys(rows[0] || { 'No records': '' }); const blob = new Blob([csvText(headers, rows.map((row) => headers.map((header) => row[header])))] , { type: 'text/csv;charset=utf-8' }); return download(blob, filename) } if (format === 'xlsx') { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), type); return download(new Blob([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename) } const { jsPDF } = await loadPdf(); const pdf = new jsPDF(); pdf.text(`${type} Export`, 14, 16); let y = 26; rows.slice(0, 40).forEach((row) => { pdf.text(Object.values(row).join(' | ').slice(0, 170), 14, y); y += 7; if (y > 280) { pdf.addPage(); y = 16 } }); pdf.save(filename) }
function download(blob, name) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url) }
export async function importValidated(uid, type, rows) {
  let imported = 0
  try {
    for (const row of rows) {
      if (type === 'Clients') await createClient(uid, { name: row.Name, normalizedName: row.Name.toLowerCase(), email: row.Email || null, phone: row.Phone || null, clientTypeId: row['Client Type'] || 'Other', status: row.Status || 'Active' })
      if (type === 'Projects') await createProject(uid, { name: row.Name, normalizedName: row.Name.toLowerCase(), clientId: row['Client ID'], projectTypeId: row['Project Type'], status: row.Status || 'Planning', priority: 'Medium', currency: row.Currency || 'INR', totalAmountMinor: toMinorUnits(row['Total Amount']), receivedAmountMinor: 0, startDate: row['Start Date'] })
      if (type === 'Accounts') await createAccount(uid, { name: row.Name, accountTypeId: row['Account Type'], currency: row.Currency || 'INR', openingBalanceMinor: toMinorUnits(row['Opening Balance']), status: row.Status || 'Active' })
      if (type === 'Income') await createIncome(uid, { title: row.Title, amountMinor: toMinorUnits(row.Amount), accountId: row['Account ID'], currency: row.Currency, receivedDate: row['Received Date'], incomeCategoryId: row['Income Category'], paymentModeId: row['Payment Mode'], sourceType: row['Source Type'], projectId: row['Project ID'] || null, clientId: row['Client ID'] || null, paymentTypeId: row['Payment Type'] || null })
      if (type === 'Expenses') await createExpense(uid, { title: row.Title, amountMinor: toMinorUnits(row.Amount), currency: row.Currency, expenseType: row['Expense Type'], categoryId: row.Category, expenseDate: row['Expense Date'], paymentStatus: row['Payment Status'], accountId: row['Account ID'] || null, paymentModeId: row['Payment Mode'] || null, paidDate: row['Paid Date'] || null, projectId: row['Project ID'] || null, clientId: row['Client ID'] || null })
      imported += 1
    }
    return { imported }
  } catch (error) {
    error.imported = imported
    throw error
  }
}
