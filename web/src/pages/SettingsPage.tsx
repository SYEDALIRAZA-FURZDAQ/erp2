import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';
import { api, errorText, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';

export interface Company {
  id?: string;
  name: string;
  legalName: string | null;
  ntn: string | null;
  strn: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  workingDays: string[];
  saturdayRule: 'off' | 'working' | 'alternate_1_3' | 'alternate_2_4' | 'custom';
  workStartTime: string;
  workEndTime: string;
  lateGraceMinutes: number;
  halfDayHours: number;
}

interface Series {
  id: string;
  docType: string;
  fiscalYear: string;
  prefix: string;
  padding: number;
  nextNumber: string;
  preview: string;
}

interface ReversiblePayroll {
  id: string;
  runNumber: string;
  month: number;
  year: number;
  status: string;
  totalNet: string;
  totalGross: string;
  paymentDate: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
}

interface ReversibleVoucher {
  id: string;
  entryNumber: string;
  entryDate: string;
  voucherType: string;
  narration: string | null;
  reference: string | null;
  totalAmount: string;
  isPosted: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

export default function SettingsPage() {
  const { can, session } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'numbering' | 'reversals'>('profile');

  const isOwner = session?.user?.isOwner ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Administration"
        subtitle="Configure company parameters, working days schedule, numbering formats, and owner controls"
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'profile'
              ? 'bg-indigo-50 text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('profile')}
        >
          <span>🏢</span> Company Profile
        </button>

        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'schedule'
              ? 'bg-indigo-50 text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('schedule')}
        >
          <span>📅</span> Working Days & Schedule
        </button>

        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'numbering'
              ? 'bg-indigo-50 text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('numbering')}
        >
          <span>🔢</span> Document Numbering
        </button>

        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'reversals'
              ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('reversals')}
        >
          <span>🛡️</span> Owner Transaction Reversal
          {isOwner && (
            <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white uppercase tracking-wider">
              Owner
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'profile' && <CompanyCard canEdit={can('core.settings.manage')} />}
      {activeTab === 'schedule' && <WorkScheduleCard canEdit={can('core.settings.manage')} />}
      {activeTab === 'numbering' && <NumberingCard canEdit={can('core.numbering.manage')} />}
      {activeTab === 'reversals' && <OwnerReversalCard isOwner={isOwner} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Company Profile Card
// ─────────────────────────────────────────────────────────────────────────────

function CompanyCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['company'], queryFn: () => api<Company>('/company') });
  const [f, setF] = useState<Company | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) setF(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => put<Company>('/company', f),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['company'] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (!f) return <div className="card">Loading company profile…</div>;

  const text = (k: keyof Company, label: string, placeholder?: string) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        disabled={!canEdit}
        placeholder={placeholder}
        value={(f[k] as string | null) ?? ''}
        onChange={(e) => {
          setSaved(false);
          setF({ ...f, [k]: e.target.value });
        }}
      />
    </div>
  );

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Company Profile</h2>
          <p className="text-xs text-slate-500">Legal entity information and tax identifiers</p>
        </div>
        {canEdit && (
          <button className="btn" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      <ErrorBox message={save.error ? errorText(save.error) : null} />
      {saved && <SuccessBox message="Company profile updated successfully!" />}

      <div className="grid gap-4 sm:grid-cols-2">
        {text('name', 'Company Name *', 'e.g., TechVentures Pvt Ltd')}
        {text('legalName', 'Legal / Registered Name', 'Full statutory registered name')}
        {text('ntn', 'National Tax Number (NTN)', '7-digit or 8-digit NTN')}
        {text('strn', 'Sales Tax Registration (STRN)', 'Sales tax number for FBR invoicing')}
        {text('cnic', 'CNIC (Sole Proprietor / Director)', 'XXXXX-XXXXXXX-X')}
        {text('phone', 'Official Phone', '+92 300 1234567')}
        {text('email', 'Official Email', 'contact@company.com')}
        {text('city', 'City', 'Karachi, Lahore, Islamabad')}
        {text('province', 'Province', 'Sindh, Punjab, etc.')}
        {text('address', 'Full Street Address', 'Office building, street, area')}
        {text('baseCurrency', 'Base Currency (ISO Code)', 'PKR')}

        <div>
          <label className="label">Fiscal Year Starts In</label>
          <select
            className="input"
            disabled={!canEdit}
            value={f.fiscalYearStartMonth}
            onChange={(e) => {
              setSaved(false);
              setF({ ...f, fiscalYearStartMonth: Number(e.target.value) });
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m} (Typical in Pakistan: July)
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Company Working Days & Schedule Card
// ─────────────────────────────────────────────────────────────────────────────

function WorkScheduleCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['company'], queryFn: () => api<Company>('/company') });
  const [f, setF] = useState<Company | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) {
      setF({
        ...q.data,
        workingDays: q.data.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        saturdayRule: q.data.saturdayRule || 'off',
        workStartTime: q.data.workStartTime || '09:00',
        workEndTime: q.data.workEndTime || '18:00',
        lateGraceMinutes: q.data.lateGraceMinutes ?? 15,
        halfDayHours: q.data.halfDayHours ?? 4.0,
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => put<Company>('/company', f),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['company'] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (!f) return <div className="card">Loading work schedule settings…</div>;

  const toggleDay = (dayKey: string) => {
    if (!canEdit) return;
    setSaved(false);
    const current = f.workingDays || [];
    const exists = current.includes(dayKey);
    let next: string[];
    if (exists) {
      next = current.filter((d) => d !== dayKey);
    } else {
      next = [...current, dayKey];
    }
    setF({ ...f, workingDays: next });
  };

  const applyPreset = (preset: 'standard5' | 'sixday' | 'alt13' | 'alt24') => {
    if (!canEdit) return;
    setSaved(false);
    if (preset === 'standard5') {
      setF({
        ...f,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        saturdayRule: 'off',
      });
    } else if (preset === 'sixday') {
      setF({
        ...f,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        saturdayRule: 'working',
      });
    } else if (preset === 'alt13') {
      setF({
        ...f,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        saturdayRule: 'alternate_1_3',
      });
    } else if (preset === 'alt24') {
      setF({
        ...f,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        saturdayRule: 'alternate_2_4',
      });
    }
  };

  return (
    <form
      className="card space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Office Working Days & Timings</h2>
          <p className="text-xs text-slate-500">
            Define regular working days, custom Saturday off/working policies, and shift parameters
          </p>
        </div>
        {canEdit && (
          <button className="btn" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Schedule'}
          </button>
        )}
      </div>

      <ErrorBox message={save.error ? errorText(save.error) : null} />
      {saved && <SuccessBox message="Work schedule settings saved successfully!" />}

      {/* Quick Presets */}
      <div>
        <label className="label mb-1.5">⚡ Quick Office Presets</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost text-xs border border-slate-200 hover:bg-slate-50"
            disabled={!canEdit}
            onClick={() => applyPreset('standard5')}
          >
            🏢 5-Day Week (Mon-Fri, Sat & Sun Off)
          </button>
          <button
            type="button"
            className="btn-ghost text-xs border border-slate-200 hover:bg-slate-50"
            disabled={!canEdit}
            onClick={() => applyPreset('sixday')}
          >
            💼 6-Day Week (Mon-Sat, Sun Off)
          </button>
          <button
            type="button"
            className="btn-ghost text-xs border border-slate-200 hover:bg-slate-50"
            disabled={!canEdit}
            onClick={() => applyPreset('alt13')}
          >
            🔄 Alternate Saturdays (1st & 3rd Off, 2nd & 4th Working)
          </button>
          <button
            type="button"
            className="btn-ghost text-xs border border-slate-200 hover:bg-slate-50"
            disabled={!canEdit}
            onClick={() => applyPreset('alt24')}
          >
            🔄 Alternate Saturdays (2nd & 4th Off, 1st & 3rd Working)
          </button>
        </div>
      </div>

      {/* Interactive Working Days Selector */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <label className="label mb-1 font-semibold text-slate-800">Regular Weekly Working Days</label>
        <p className="text-xs text-slate-500 mb-3">
          Click on any day to toggle between Working Day and Off / Weekend.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {DAYS_OF_WEEK.map((d) => {
            const isWorking = (f.workingDays || []).includes(d.key);
            const isSaturday = d.key === 'saturday';
            return (
              <button
                key={d.key}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleDay(d.key)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                  isWorking
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-semibold">{d.label}</span>
                <span className={`text-[11px] mt-1 font-medium ${isWorking ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {isWorking ? '✓ Working' : '✕ Off Day'}
                </span>
                {isSaturday && (
                  <span
                    className={`mt-1 text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                      isWorking ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    Policy Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Saturday Policy Configuration */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-xs">
          <label className="label font-semibold text-slate-800">Saturday Office Policy</label>
          <p className="text-xs text-slate-500 mb-3">
            Some offices give Saturday off, some stay open, and some operate alternate Saturdays.
          </p>
          <select
            className="input"
            disabled={!canEdit}
            value={f.saturdayRule}
            onChange={(e) => {
              setSaved(false);
              const val = e.target.value as any;
              let nextDays = [...(f.workingDays || [])];
              if (val === 'off') {
                nextDays = nextDays.filter((d) => d !== 'saturday');
              } else if (!nextDays.includes('saturday')) {
                nextDays.push('saturday');
              }
              setF({ ...f, saturdayRule: val, workingDays: nextDays });
            }}
          >
            <option value="off">Every Saturday Off (Standard 5-day week)</option>
            <option value="working">Every Saturday Working (Full 6-day week)</option>
            <option value="alternate_1_3">Alternate Saturdays: 1st & 3rd Off, 2nd & 4th Working</option>
            <option value="alternate_2_4">Alternate Saturdays: 2nd & 4th Off, 1st & 3rd Working</option>
            <option value="custom">Flexible / Usually Open (Off days designated on demand)</option>
          </select>

          <div className="mt-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600">
            {f.saturdayRule === 'off' && (
              <p>📌 <strong>Saturday Off:</strong> Saturdays and Sundays will be marked as non-working weekends in the Attendance calendar.</p>
            )}
            {f.saturdayRule === 'working' && (
              <p>📌 <strong>Saturday Working:</strong> All Saturdays are normal working business days with standard check-in tracking.</p>
            )}
            {f.saturdayRule === 'alternate_1_3' && (
              <p>📌 <strong>1st & 3rd Saturday Off:</strong> The 1st and 3rd Saturdays of every month are weekend off days, while the 2nd and 4th Saturdays are working days.</p>
            )}
            {f.saturdayRule === 'alternate_2_4' && (
              <p>📌 <strong>2nd & 4th Saturday Off:</strong> The 2nd and 4th Saturdays of every month are weekend off days, while the 1st and 3rd Saturdays are working days.</p>
            )}
            {f.saturdayRule === 'custom' && (
              <p>📌 <strong>Flexible:</strong> Saturdays are treated as working by default unless explicitly granted as leave or public holiday.</p>
            )}
          </div>
        </div>

        {/* Business Hours & Late Thresholds */}
        <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-xs space-y-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Shift Hours & Attendance Thresholds</h3>
            <p className="text-xs text-slate-500">Standard office check-in / check-out times</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Shift Start Time</label>
              <input
                type="time"
                className="input"
                disabled={!canEdit}
                value={f.workStartTime}
                onChange={(e) => {
                  setSaved(false);
                  setF({ ...f, workStartTime: e.target.value });
                }}
              />
            </div>
            <div>
              <label className="label">Shift End Time</label>
              <input
                type="time"
                className="input"
                disabled={!canEdit}
                value={f.workEndTime}
                onChange={(e) => {
                  setSaved(false);
                  setF({ ...f, workEndTime: e.target.value });
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Late Grace Period</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={120}
                  className="input"
                  disabled={!canEdit}
                  value={f.lateGraceMinutes}
                  onChange={(e) => {
                    setSaved(false);
                    setF({ ...f, lateGraceMinutes: Number(e.target.value) });
                  }}
                />
                <span className="text-xs text-slate-500">mins</span>
              </div>
            </div>

            <div>
              <label className="label">Half-Day Threshold</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={12}
                  step={0.5}
                  className="input"
                  disabled={!canEdit}
                  value={f.halfDayHours}
                  onChange={(e) => {
                    setSaved(false);
                    setF({ ...f, halfDayHours: Number(e.target.value) });
                  }}
                />
                <span className="text-xs text-slate-500">hours</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Document Numbering Card
// ─────────────────────────────────────────────────────────────────────────────

function NumberingCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['numbering'], queryFn: () => api<Series[]>('/numbering') });
  const save = useMutation({
    mutationFn: (s: Series) => put(`/numbering/${s.id}`, { prefix: s.prefix, padding: s.padding }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['numbering'] }),
  });

  return (
    <div className="card overflow-x-auto space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">Document Numbering & Sequences</h2>
        <p className="text-xs text-slate-500">
          Auto-generated prefixes and padding for invoices, vouchers, and payroll disbursements
        </p>
      </div>

      <ErrorBox message={q.error ? errorText(q.error) : save.error ? errorText(save.error) : null} />

      <table className="min-w-full">
        <thead>
          <tr>
            <th className="th">Document Type</th>
            <th className="th">Prefix</th>
            <th className="th">Digits</th>
            <th className="th">Next Number Preview</th>
            <th className="th text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {q.data?.map((s) => (
            <SeriesRow key={s.id} s={s} canEdit={canEdit} onSave={(x) => save.mutate(x)} />
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500">
        Numbers are allocated inside the posting transaction to guarantee gap-free audit compliance.
      </p>
    </div>
  );
}

function SeriesRow({
  s,
  canEdit,
  onSave,
}: {
  s: Series;
  canEdit: boolean;
  onSave: (s: Series) => void;
}) {
  const [prefix, setPrefix] = useState(s.prefix);
  const [padding, setPadding] = useState(s.padding);
  const dirty = prefix !== s.prefix || padding !== s.padding;

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="td font-medium text-slate-800">{s.docType.replace(/_/g, ' ')}</td>
      <td className="td">
        <input
          className="input w-32"
          disabled={!canEdit}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
      </td>
      <td className="td">
        <input
          className="input w-20"
          type="number"
          min={1}
          max={12}
          disabled={!canEdit}
          value={padding}
          onChange={(e) => setPadding(Number(e.target.value))}
        />
      </td>
      <td className="td font-mono text-xs text-indigo-600 font-semibold">{s.preview}</td>
      <td className="td text-right">
        {canEdit && dirty && (
          <button className="btn text-xs py-1 px-3" onClick={() => onSave({ ...s, prefix, padding })}>
            Save
          </button>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Owner Transaction Reversal Console
// ─────────────────────────────────────────────────────────────────────────────

function OwnerReversalCard({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'payroll' | 'vouchers'>('payroll');
  const [selectedTx, setSelectedTx] = useState<{
    type: 'payroll' | 'voucher';
    id: string;
    title: string;
    amount: string;
    date: string;
  } | null>(null);

  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const query = useQuery({
    queryKey: ['reversible-transactions'],
    queryFn: () =>
      api<{ payrolls: ReversiblePayroll[]; vouchers: ReversibleVoucher[] }>(
        '/company/transactions/reversible',
      ),
    enabled: isOwner,
  });

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;
    if (!password) {
      setActionError('Owner password is required to authorize transaction reversal.');
      return;
    }
    if (!reason.trim()) {
      setActionError('Please provide a reason for the reversal.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      const res = await post<{ success: boolean; message: string }>('/company/transactions/reverse', {
        transactionType: selectedTx.type,
        id: selectedTx.id,
        password,
        reason,
      });

      setActionSuccess(res.message);
      setSelectedTx(null);
      setPassword('');
      setReason('');
      void qc.invalidateQueries({ queryKey: ['reversible-transactions'] });
      void qc.invalidateQueries({ queryKey: ['payroll'] });
      void qc.invalidateQueries({ queryKey: ['vouchers'] });
      void qc.invalidateQueries({ queryKey: ['invoices'] });
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['accounting'] });
      void qc.invalidateQueries({ queryKey: ['reports'] });
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Transaction reversal failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="card border-amber-200 bg-amber-50/40 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-3 text-2xl">🛡️</div>
          <div>
            <h3 className="font-semibold text-slate-900">Owner Authorization Required</h3>
            <p className="mt-1 text-sm text-slate-600">
              Transaction reversals (such as reverting accidentally paid payroll or reversing general ledger
              journal vouchers) are strictly restricted to the primary Company Owner for financial security.
            </p>
            <p className="mt-2 text-xs text-amber-800 font-medium">
              Log in with the Company Owner account to access transaction reversal controls.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const payrolls = query.data?.payrolls || [];
  const vouchers = query.data?.vouchers || [];

  return (
    <div className="card space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h2 className="text-base font-semibold text-slate-900">Owner Transaction Reversal Console</h2>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
              High Security
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reverse accidentally disbursed payroll runs or posted journal entries. All actions require owner
            password confirmation and are permanently recorded in the audit trail.
          </p>
        </div>
      </div>

      {actionSuccess && <SuccessBox message={actionSuccess} />}
      {actionError && <ErrorBox message={actionError} />}

      {/* Sub tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            subTab === 'payroll'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          onClick={() => setSubTab('payroll')}
        >
          💼 Disbursed Payroll Runs ({payrolls.length})
        </button>

        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            subTab === 'vouchers'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          onClick={() => setSubTab('vouchers')}
        >
          📑 Posted Journal Vouchers ({vouchers.length})
        </button>
      </div>

      {/* Content for Payroll Tab */}
      {subTab === 'payroll' && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="th">Run #</th>
                <th className="th">Period</th>
                <th className="th text-right">Net Payout</th>
                <th className="th text-center">Payment Date</th>
                <th className="th text-center">Status</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrolls.map((pr) => (
                <tr key={pr.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{pr.runNumber}</td>
                  <td className="td font-medium text-slate-800">
                    {MONTHS[pr.month - 1]} {pr.year}
                  </td>
                  <td className="td text-right font-mono font-bold text-slate-900">
                    PKR {Number(pr.totalNet).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-center text-slate-600">{pr.paymentDate || '—'}</td>
                  <td className="td text-center">
                    <StatusBadge status={pr.status} />
                  </td>
                  <td className="td text-right">
                    <button
                      type="button"
                      className="btn bg-rose-600 hover:bg-rose-700 text-xs py-1 px-3 shadow-xs"
                      onClick={() => {
                        setActionError(null);
                        setSelectedTx({
                          type: 'payroll',
                          id: pr.id,
                          title: `Payroll Run ${pr.runNumber} (${MONTHS[pr.month - 1]} ${pr.year})`,
                          amount: `PKR ${Number(pr.totalNet).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
                          date: pr.paymentDate || 'Paid',
                        });
                      }}
                    >
                      🔄 Reverse Payroll
                    </button>
                  </td>
                </tr>
              ))}

              {payrolls.length === 0 && !query.isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No paid payroll runs available for reversal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Content for Vouchers Tab */}
      {subTab === 'vouchers' && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="th">Voucher #</th>
                <th className="th">Date</th>
                <th className="th">Type</th>
                <th className="th">Narration / Reference</th>
                <th className="th text-right">Amount</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{v.entryNumber}</td>
                  <td className="td text-slate-600">{v.entryDate}</td>
                  <td className="td">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800">
                      {v.voucherType}
                    </span>
                  </td>
                  <td className="td text-slate-700 max-w-xs truncate">
                    {v.narration || v.reference || '—'}
                  </td>
                  <td className="td text-right font-mono font-semibold text-slate-900">
                    PKR {Number(v.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right">
                    <button
                      type="button"
                      className="btn bg-rose-600 hover:bg-rose-700 text-xs py-1 px-3 shadow-xs"
                      onClick={() => {
                        setActionError(null);
                        setSelectedTx({
                          type: 'voucher',
                          id: v.id,
                          title: `Voucher ${v.entryNumber} (${v.voucherType})`,
                          amount: `PKR ${Number(v.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
                          date: v.entryDate,
                        });
                      }}
                    >
                      🔄 Reverse Voucher
                    </button>
                  </td>
                </tr>
              ))}

              {vouchers.length === 0 && !query.isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No posted vouchers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Password Confirmation & Reversal Modal */}
      {selectedTx && (
        <Modal
          title={`Confirm Transaction Reversal: ${selectedTx.title}`}
          onClose={() => {
            if (!isSubmitting) setSelectedTx(null);
          }}
        >
          <form onSubmit={handleReverse} className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-rose-800 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                ⚠️ Caution: Financial Impact Warning
              </p>
              {selectedTx.type === 'payroll' ? (
                <p>
                  Reversing this paid payroll run will reset its status to <strong>Draft</strong>, void any linked
                  Salary Expense and Bank Disbursement journal vouchers, and restore the GL balance to its
                  pre-payout state.
                </p>
              ) : (
                <p>
                  Reversing this voucher will unpost it from the General Ledger, restoring account balances
                  and removing its impact from financial reports and trial balances.
                </p>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Target Item:</span>
                <p className="font-semibold text-slate-800">{selectedTx.title}</p>
              </div>
              <div>
                <span className="text-slate-500">Total Net Amount:</span>
                <p className="font-mono font-bold text-slate-900">{selectedTx.amount}</p>
              </div>
            </div>

            <ErrorBox message={actionError} />

            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Owner Account Password *
              </label>
              <input
                type="password"
                required
                className="input"
                placeholder="Enter your owner password to authorize..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cryptographic authentication is required to execute a financial reversal.
              </p>
            </div>

            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Reason for Reversal *
              </label>
              <textarea
                required
                rows={2}
                className="input"
                placeholder="e.g., Accidental duplicate disbursement, incorrect deductions, recalculated hours..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={isSubmitting}
                onClick={() => setSelectedTx(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-rose-600 hover:bg-rose-700 text-xs py-2 px-4 shadow-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Verifying & Reversing…' : 'Authorize & Reverse Transaction'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
