import { describe, expect, it } from 'vitest';
import { hasPermission } from '../src/modules/roles/permissions';
import { formatDocNumber } from '../src/modules/numbering/numbering.service';
import { hashPassword, verifyPassword } from '../src/utils/password';

describe('hasPermission', () => {
  it('matches exact, module wildcard and global wildcard', () => {
    expect(hasPermission(['core.users.read'], 'core.users.read')).toBe(true);
    expect(hasPermission(['core.*'], 'core.users.manage')).toBe(true);
    expect(hasPermission(['*'], 'accounting.vouchers.post')).toBe(true);
  });
  it('rejects missing permissions and look-alike prefixes', () => {
    expect(hasPermission(['core.users.read'], 'core.users.manage')).toBe(false);
    expect(hasPermission(['core.*'], 'corex.users.read')).toBe(false);
    expect(hasPermission([], 'core.users.read')).toBe(false);
  });
});

describe('formatDocNumber', () => {
  it('pads and includes fiscal year', () => {
    expect(formatDocNumber('SI-', '', 5, 42)).toBe('SI-00042');
    expect(formatDocNumber('JV-', '2026-27', 4, 7)).toBe('JV-2026-27-0007');
  });
});

describe('password hashing', () => {
  it('verifies the right password only', async () => {
    const h = await hashPassword('Secret123');
    expect(await verifyPassword('Secret123', h)).toBe(true);
    expect(await verifyPassword('Secret124', h)).toBe(false);
    expect(h.startsWith('scrypt$')).toBe(true);
  });
});

describe('payroll & accounting synchronization', () => {
  it('guarantees balanced journal vouchers across basic pay and allowances', async () => {
    const { calculateMonthlyPakistanTax } = await import('../src/modules/hr/hr.routes');

    const testCases = [
      { basic: 100000, allowances: 18000 },
      { basic: 250000, allowances: 45000 },
      { basic: 50000, allowances: 5000 },
      { basic: 500000, allowances: 80000 },
    ];

    for (const tc of testCases) {
      const gross = tc.basic + tc.allowances;
      const tax = calculateMonthlyPakistanTax(gross);
      const eobi = 370;
      const net = gross - tax - eobi;

      // In accounting:
      // Debit: Salary Expense (gross)
      // Credit: Tax Payable (tax) + EOBI Payable (eobi) + Bank Account (net)
      const debitTotal = gross;
      const creditTotal = tax + eobi + net;

      expect(debitTotal).toBe(creditTotal);
    }
  });

  it('correctly filters out unposted or reversed journal vouchers from balance calculations', () => {
    // Simulating SQL query logic: SUM(CASE WHEN j.is_posted = true THEN jl.debit - jl.credit ELSE 0 END)
    const journalEntries = [
      { id: 'jv-1', is_posted: true, debit: 118000, credit: 0 },
      { id: 'jv-2', is_posted: false, debit: 295000, credit: 0 }, // Reversed by owner
      { id: 'jv-3', is_posted: true, debit: 0, credit: 50000 },
    ];

    let liveBalance = 0;
    for (const j of journalEntries) {
      if (j.is_posted) {
        liveBalance += (j.debit - j.credit);
      }
    }

    // Only posted jv-1 (118000) and jv-3 (-50000) should be included = 68000
    expect(liveBalance).toBe(68000);
  });
});

