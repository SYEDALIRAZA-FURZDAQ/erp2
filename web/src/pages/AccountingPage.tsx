import { useEffect, useState } from 'react';
import { api, post } from '../lib/api';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';
import { useTranslation } from '../lib/i18n';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: string;
  isActive: boolean;
}

interface Voucher {
  id: string;
  entryNumber: string;
  entryDate: string;
  voucherType: string;
  narration: string | null;
  reference: string | null;
  isPosted: boolean;
  reversedAt?: string | null;
  reversalReason?: string | null;
  totalDebit: string;
  totalCredit: string;
  lineCount: number;
}

interface LedgerLine {
  id: string;
  entryDate: string;
  entryNumber: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  description: string;
  runningBalance: number;
}

export default function AccountingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'accounts' | 'vouchers' | 'ledger' | 'reports'>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  // New Account form state
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: 'asset',
    subtype: '',
  });

  // New Voucher form state
  const [voucherForm, setVoucherForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    voucherType: 'JV',
    narration: '',
    reference: '',
    lines: [
      { accountId: '', debit: 0, credit: 0, description: '' },
      { accountId: '', debit: 0, credit: 0, description: '' },
    ],
  });

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await api<Account[]>('/accounting/accounts');
      setAccounts(res);
      if (res.length > 0 && !selectedAccountId) {
        setSelectedAccountId(res[0].id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const res = await api<{ items: Voucher[] }>('/accounting/vouchers');
      setVouchers(res.items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (accId?: string) => {
    try {
      setLoading(true);
      const url = accId ? `/accounting/ledger?accountId=${accId}` : '/accounting/ledger';
      const res = await api<LedgerLine[]>(url);
      setLedgerLines(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const [tb, inc] = await Promise.all([
        api('/accounting/reports/trial-balance'),
        api('/accounting/reports/income-statement'),
      ]);
      setTrialBalance(tb);
      setIncomeStatement(inc);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError(null);
    if (tab === 'accounts') loadAccounts();
    else if (tab === 'vouchers') {
      loadVouchers();
      loadAccounts();
    } else if (tab === 'ledger') {
      loadAccounts();
      loadLedger(selectedAccountId);
    } else if (tab === 'reports') loadReports();
  }, [tab]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/accounting/accounts', newAccount);
      setSuccess('Account created successfully');
      setShowAccountModal(false);
      setNewAccount({ code: '', name: '', type: 'asset', subtype: '' });
      loadAccounts();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/accounting/vouchers', voucherForm);
      setSuccess('Journal voucher posted successfully');
      setShowVoucherModal(false);
      loadVouchers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addVoucherLine = () => {
    setVoucherForm({
      ...voucherForm,
      lines: [...voucherForm.lines, { accountId: '', debit: 0, credit: 0, description: '' }],
    });
  };

  const removeVoucherLine = (idx: number) => {
    if (voucherForm.lines.length <= 2) return;
    setVoucherForm({
      ...voucherForm,
      lines: voucherForm.lines.filter((_, i) => i !== idx),
    });
  };

  const totalDebit = voucherForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = voucherForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01 && totalDebit > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('accounting.title', 'Accounting & General Ledger')}
        subtitle={t('accounting.subtitle', 'Double-entry ledger, Chart of Accounts, Journal Vouchers, and Financial Statements')}
      >
        {tab === 'accounts' && (
          <button className="btn" onClick={() => setShowAccountModal(true)}>
            {t('accounting.new_account', '+ New Account')}
          </button>
        )}
        {tab === 'vouchers' && (
          <button className="btn" onClick={() => setShowVoucherModal(true)}>
            {t('accounting.new_voucher', '+ New Journal Voucher')}
          </button>
        )}
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'accounts'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('accounts')}
        >
          {t('accounting.chart_of_accounts', 'Chart of Accounts')}
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'vouchers'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('vouchers')}
        >
          {t('accounting.journal_vouchers', 'Journal Vouchers')}
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'ledger'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('ledger')}
        >
          {t('accounting.general_ledger', 'General Ledger')}
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'reports'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('reports')}
        >
          {t('accounting.financial_reports', 'Financial Reports')}
        </button>
      </div>

      {/* TAB 1: Chart of Accounts */}
      {tab === 'accounts' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Code</th>
                <th className="th">Account Name</th>
                <th className="th">Type</th>
                <th className="th">Subtype</th>
                <th className="th text-right">Current Balance</th>
                <th className="th text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{a.code}</td>
                  <td className="td font-medium text-slate-900">{a.name}</td>
                  <td className="td capitalize text-slate-600">{a.type}</td>
                  <td className="td text-slate-500">{a.subtype?.replace(/_/g, ' ') || '—'}</td>
                  <td className="td text-right font-mono font-semibold text-slate-900">
                    PKR {Number(a.balance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-center">
                    <StatusBadge status={a.isActive ? 'active' : 'inactive'} />
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No accounts found. Create your first account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Journal Vouchers */}
      {tab === 'vouchers' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Entry #</th>
                <th className="th">Date</th>
                <th className="th">Type</th>
                <th className="th">Narration</th>
                <th className="th">Reference</th>
                <th className="th text-right">Debit (PKR)</th>
                <th className="th text-right">Credit (PKR)</th>
                <th className="th text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{v.entryNumber}</td>
                  <td className="td text-slate-600">{v.entryDate}</td>
                  <td className="td font-medium">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800">{v.voucherType}</span>
                  </td>
                  <td className="td text-slate-700 max-w-xs truncate">{v.narration || '—'}</td>
                  <td className="td text-slate-500">{v.reference || '—'}</td>
                  <td className="td text-right font-mono text-slate-900">
                    {Number(v.totalDebit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono text-slate-900">
                    {Number(v.totalCredit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <StatusBadge status={v.isPosted ? 'posted' : 'reversed'} />
                      {!v.isPosted && v.reversalReason && (
                        <span className="text-[10px] text-rose-500 max-w-[120px] truncate" title={v.reversalReason}>
                          {v.reversalReason}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {vouchers.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No journal vouchers recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: General Ledger */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="card flex items-center gap-4 bg-slate-50">
            <label className="text-sm font-medium text-slate-700">Filter by Account:</label>
            <select
              className="input max-w-xs"
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                loadLedger(e.target.value);
              }}
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">Date</th>
                  <th className="th">Entry #</th>
                  <th className="th">Account</th>
                  <th className="th">Description</th>
                  <th className="th text-right">Debit (PKR)</th>
                  <th className="th text-right">Credit (PKR)</th>
                  <th className="th text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerLines.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="td text-slate-600">{l.entryDate}</td>
                    <td className="td font-mono text-indigo-600">{l.entryNumber}</td>
                    <td className="td font-medium text-slate-800">
                      {l.accountCode} - {l.accountName}
                    </td>
                    <td className="td text-slate-600">{l.description || '—'}</td>
                    <td className="td text-right font-mono text-slate-900">
                      {Number(l.debit) > 0 ? Number(l.debit).toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="td text-right font-mono text-slate-900">
                      {Number(l.credit) > 0 ? Number(l.credit).toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="td text-right font-mono font-bold text-slate-900">
                      PKR {l.runningBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {ledgerLines.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No ledger transactions found for selected account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Financial Reports */}
      {tab === 'reports' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Trial Balance */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Trial Balance</h2>
              {trialBalance && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    trialBalance.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {trialBalance.isBalanced ? 'Balanced ✓' : 'Out of Balance'}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-xs font-semibold uppercase text-slate-500">Account</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase text-slate-500">Debit (PKR)</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase text-slate-500">Credit (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trialBalance?.accounts?.map((a: any) => (
                    <tr key={a.id}>
                      <td className="py-2 font-medium text-slate-800">
                        {a.code} - {a.name}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-900">
                        {a.netDebit > 0 ? a.netDebit.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-900">
                        {a.netCredit > 0 ? a.netCredit.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-900 font-bold bg-slate-50">
                    <td className="py-2.5 text-slate-900">Grand Total</td>
                    <td className="py-2.5 text-right font-mono text-slate-900">
                      PKR {trialBalance?.grandDebit?.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-900">
                      PKR {trialBalance?.grandCredit?.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Income Statement / P&L */}
          <div className="card">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Profit & Loss Statement (P&L)</h2>
              <p className="text-xs text-slate-500">Summary of Operating Revenues and Operating Expenses</p>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-emerald-800 uppercase text-xs tracking-wider mb-2">Revenues</h3>
                <div className="space-y-1">
                  {incomeStatement?.revenues?.map((r: any) => (
                    <div key={r.code} className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-700">
                        {r.code} - {r.name}
                      </span>
                      <span className="font-mono font-medium text-slate-900">
                        PKR {Number(r.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-semibold text-emerald-900">
                    <span>Total Revenue</span>
                    <span className="font-mono">
                      PKR {incomeStatement?.totalRevenue?.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-rose-800 uppercase text-xs tracking-wider mb-2">Expenses</h3>
                <div className="space-y-1">
                  {incomeStatement?.expenses?.map((e: any) => (
                    <div key={e.code} className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-700">
                        {e.code} - {e.name}
                      </span>
                      <span className="font-mono font-medium text-slate-900">
                        PKR {Number(e.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-semibold text-rose-900">
                    <span>Total Expenses</span>
                    <span className="font-mono">
                      PKR {incomeStatement?.totalExpense?.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-indigo-50 p-4 border border-indigo-100 flex justify-between items-center">
                <span className="font-bold text-indigo-950 text-base">Net Profit / (Loss)</span>
                <span
                  className={`text-xl font-mono font-bold ${
                    (incomeStatement?.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  PKR {incomeStatement?.netProfit?.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Account */}
      {showAccountModal && (
        <Modal title="Create New Account" onClose={() => setShowAccountModal(false)}>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="label">Account Code</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. 1050"
                value={newAccount.code}
                onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Account Name</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Petty Cash"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Account Type</label>
                <select
                  className="input"
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="label">Subtype</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. current_asset"
                  value={newAccount.subtype}
                  onChange={(e) => setNewAccount({ ...newAccount, subtype: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowAccountModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Save Account
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Create Voucher */}
      {showVoucherModal && (
        <Modal title="Create Double-Entry Journal Voucher" maxWidth="max-w-2xl" onClose={() => setShowVoucherModal(false)}>
          <form onSubmit={handleCreateVoucher} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Voucher Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={voucherForm.entryDate}
                  onChange={(e) => setVoucherForm({ ...voucherForm, entryDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Voucher Type</label>
                <select
                  className="input"
                  value={voucherForm.voucherType}
                  onChange={(e) => setVoucherForm({ ...voucherForm, voucherType: e.target.value })}
                >
                  <option value="JV">Journal Voucher (JV)</option>
                  <option value="CV">Cash Voucher (CV)</option>
                  <option value="BV">Bank Voucher (BV)</option>
                </select>
              </div>
              <div>
                <label className="label">Reference / Doc #</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. CHQ-991"
                  value={voucherForm.reference}
                  onChange={(e) => setVoucherForm({ ...voucherForm, reference: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Narration / Remarks</label>
              <input
                type="text"
                className="input"
                placeholder="Brief explanation of entry..."
                value={voucherForm.narration}
                onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
              />
            </div>

            {/* Voucher Lines */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Accounting Lines</span>
                <button type="button" className="text-xs text-indigo-600 font-semibold hover:underline" onClick={addVoucherLine}>
                  + Add Line
                </button>
              </div>

              <div className="space-y-2">
                {voucherForm.lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      className="input flex-1"
                      required
                      value={line.accountId}
                      onChange={(e) => {
                        const newLines = [...voucherForm.lines];
                        newLines[idx].accountId = e.target.value;
                        setVoucherForm({ ...voucherForm, lines: newLines });
                      }}
                    >
                      <option value="">Select Account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name} ({a.type})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-28 text-right font-mono"
                      placeholder="Debit"
                      value={line.debit || ''}
                      onChange={(e) => {
                        const newLines = [...voucherForm.lines];
                        newLines[idx].debit = parseFloat(e.target.value) || 0;
                        if (newLines[idx].debit > 0) newLines[idx].credit = 0;
                        setVoucherForm({ ...voucherForm, lines: newLines });
                      }}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-28 text-right font-mono"
                      placeholder="Credit"
                      value={line.credit || ''}
                      onChange={(e) => {
                        const newLines = [...voucherForm.lines];
                        newLines[idx].credit = parseFloat(e.target.value) || 0;
                        if (newLines[idx].credit > 0) newLines[idx].debit = 0;
                        setVoucherForm({ ...voucherForm, lines: newLines });
                      }}
                    />

                    {voucherForm.lines.length > 2 && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600 px-1"
                        onClick={() => removeVoucherLine(idx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Balance Bar */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs">
                <div className="flex gap-4">
                  <span>
                    Total Debit: <b className="font-mono">PKR {totalDebit.toFixed(2)}</b>
                  </span>
                  <span>
                    Total Credit: <b className="font-mono">PKR {totalCredit.toFixed(2)}</b>
                  </span>
                </div>
                <div>
                  {isBalanced ? (
                    <span className="font-semibold text-emerald-600">✓ Balanced</span>
                  ) : (
                    <span className="font-semibold text-rose-600">Difference: PKR {diff.toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowVoucherModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={!isBalanced} className="btn">
                Post Voucher
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
