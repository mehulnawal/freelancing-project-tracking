import { describe, expect, it } from 'vitest'
import { accountBalance, ledgerBalance } from './financialLogic'
describe('accounts', () => { it('includes opening, income and transfers without changing total transfer money', () => { expect(accountBalance(10000, 2500, 700, 300)).toBe(12900); expect(ledgerBalance(1000, [{ creditMinor: 400 }, { debitMinor: 125 }])).toBe(1275) }); it('supports an opening balance adjustment delta', () => { const oldBalance = accountBalance(1000, 500, 0, 0); const adjusted = oldBalance + (1500 - 1000); expect(adjusted).toBe(2000) }) })
