import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorText, patch, post } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { EmptyState, ErrorBox, Modal, PageHeader, StatCard, StatusBadge, SuccessBox } from '../components/ui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string;
  designation: string;
}

interface AttendanceRow {
  id: string | null;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  designation: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  remarks: string | null;
}

interface MonthDay {
  date: string;   // YYYY-MM-DD
  status: string; // present | absent | late | half_day | on_leave | weekend | future
  checkIn: string | null;
  checkOut: string | null;
  remarks: string | null;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface SummaryKpi {
  totalEmployees: number;
  today: string;
  present: number;
  absent: number;
  late: number;
  half_day: number;
  on_leave: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}
const TODAY = localDateStr();

function toLocalTime() {
  return new Date().toTimeString().slice(0, 5); // HH:MM
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(localDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isDayOff(dateStr: string, company?: any): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const dayIndex = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayIndex];

  if (!company) {
    return dayIndex === 0 || dayIndex === 6;
  }

  // Saturday Policy
  if (dayIndex === 6) {
    const satRule = company.saturdayRule || 'off';
    if (satRule === 'off') return true;
    if (satRule === 'working') return false;
    if (satRule === 'alternate_1_3' || satRule === 'alternate_2_4') {
      const dayOfMonth = d.getDate();
      const satNum = Math.ceil(dayOfMonth / 7);
      const isOdd = satNum % 2 === 1;
      return satRule === 'alternate_1_3' ? isOdd : !isOdd;
    }
  }

  // Check explicit workingDays
  if (company.workingDays && Array.isArray(company.workingDays)) {
    return !company.workingDays.includes(dayName);
  }

  return dayIndex === 0 || dayIndex === 6;
}

const STATUS_COLOR: Record<string, string> = {
  present:  'bg-emerald-500',
  late:     'bg-amber-400',
  half_day: 'bg-blue-400',
  on_leave: 'bg-purple-400',
  absent:   'bg-rose-400',
  weekend:  'bg-slate-200',
  future:   'bg-slate-100',
};

const STATUS_TEXT: Record<string, string> = {
  present:  'text-white',
  late:     'text-white',
  half_day: 'text-white',
  on_leave: 'text-white',
  absent:   'text-white',
  weekend:  'text-slate-400',
  future:   'text-slate-300',
};

// ─── Calendar View Component ─────────────────────────────────────────────────

function MonthCalendar({
  employeeId,
  employees,
  company,
}: {
  employeeId: string;
  employees: Employee[];
  company?: any;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<MonthDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [selDay, setSelDay] = useState<MonthDay | null>(null);

  const employee = employees.find((e) => e.id === employeeId);

  const load = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const records = await api<{ date: string; status: string; checkIn: string | null; checkOut: string | null; remarks: string | null }[]>(
        `/attendance/monthly?employeeId=${employeeId}&year=${year}&month=${month}`
      );

      const recordMap = new Map(records.map((r) => [r.date, r]));
      const allDays = getDaysInMonth(year, month);

      setDays(
        allDays.map((d) => {
          if (isDayOff(d, company)) return { date: d, status: 'weekend', checkIn: null, checkOut: null, remarks: null };
          if (d > TODAY) return { date: d, status: 'future', checkIn: null, checkOut: null, remarks: null };
          const rec = recordMap.get(d);
          return {
            date: d,
            status: rec?.status ?? 'absent',
            checkIn: rec?.checkIn ?? null,
            checkOut: rec?.checkOut ?? null,
            remarks: rec?.remarks ?? null,
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [employeeId, year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Stats
  const counts = days.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{employee?.fullName ?? '—'}</p>
          <p className="text-xs text-slate-500">{employee?.department} · {employee?.designation}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-ghost py-1 px-3">‹</button>
          <span className="text-sm font-semibold text-slate-800 min-w-[130px] text-center">
            {monthLabel(year, month)}
          </span>
          <button onClick={nextMonth} className="btn-ghost py-1 px-3">›</button>
        </div>
      </div>

      {/* Monthly stats */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { key: 'present',  label: 'Present',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
          { key: 'late',     label: 'Late',      color: 'bg-amber-100 text-amber-800 border-amber-200' },
          { key: 'half_day', label: 'Half Day',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
          { key: 'on_leave', label: 'On Leave',  color: 'bg-purple-100 text-purple-800 border-purple-200' },
          { key: 'absent',   label: 'Absent',    color: 'bg-rose-100 text-rose-800 border-rose-200' },
        ].map(({ key, label, color }) => (
          <span key={key} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${color}`}>
            {label}: <b>{counts[key] ?? 0}</b>
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : (
        <div>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-bold uppercase text-slate-400 py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {days.map((d) => {
              const dayNum = Number(d.date.slice(8));
              const isToday = d.date === TODAY;
              const bgColor = STATUS_COLOR[d.status] ?? 'bg-slate-100';
              const textColor = STATUS_TEXT[d.status] ?? 'text-slate-400';
              const clickable = d.status !== 'weekend' && d.status !== 'future';

              return (
                <button
                  key={d.date}
                  disabled={!clickable}
                  onClick={() => clickable && setSelDay(d)}
                  title={`${d.date} — ${d.status}`}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center rounded-lg
                    text-xs font-bold transition-all
                    ${bgColor} ${textColor}
                    ${clickable ? 'hover:opacity-80 hover:shadow-sm cursor-pointer' : 'cursor-default'}
                    ${isToday ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}
                  `}
                >
                  <span>{dayNum}</span>
                  {d.checkIn && (
                    <span className="text-[7px] opacity-75 leading-none mt-0.5 hidden sm:block">
                      {d.checkIn.slice(0, 5)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            {[
              { color: 'bg-emerald-500', label: 'Present' },
              { color: 'bg-amber-400',   label: 'Late' },
              { color: 'bg-blue-400',    label: 'Half Day' },
              { color: 'bg-purple-400',  label: 'On Leave' },
              { color: 'bg-rose-400',    label: 'Absent' },
              { color: 'bg-slate-200',   label: 'Weekend' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Day detail flyout */}
      {selDay && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-800">{fmtDate(selDay.date)}</p>
            <button onClick={() => setSelDay(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕ close</button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span><b>Status:</b> <StatusBadge status={selDay.status} /></span>
            <span><b>Check-in:</b> {selDay.checkIn ?? '—'}</span>
            <span><b>Check-out:</b> {selDay.checkOut ?? '—'}</span>
            {selDay.remarks && <span><b>Remarks:</b> {selDay.remarks}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = 'sheet' | 'calendar' | 'leaves';

export default function AttendancePage() {
  const { t } = useTranslation();
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: () => api<any>('/company') });
  const [tab, setTab] = useState<Tab>('sheet');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [summary, setSummary] = useState<SummaryKpi | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calendar tab: selected employee
  const [calEmployee, setCalEmployee] = useState('');

  // Inline checkout
  const [checkoutRow, setCheckoutRow] = useState<AttendanceRow | null>(null);
  const [checkoutTime, setCheckoutTime] = useState(toLocalTime());

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    leaveType: 'annual',
    startDate: TODAY,
    endDate: TODAY,
    reason: '',
  });

  // Marking in progress (per employee)
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  const successTimer = useRef<ReturnType<typeof setTimeout>>();

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(null), 3500);
  };

  // ── Data loading ─────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, sumRes] = await Promise.all([
        api<AttendanceRow[]>(`/attendance/records?date=${selectedDate}`),
        api<SummaryKpi>(`/attendance/summary?date=${TODAY}`),
      ]);
      setRecords(recRes);
      setSummary(sumRes);
      if (recRes.length > 0) {
        setLeaveForm((f) => ({ ...f, employeeId: f.employeeId || recRes[0].employeeId }));
        setCalEmployee((c) => c || recRes[0].employeeId);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const loadLeaves = async () => {
    try {
      const lvsRes = await api<LeaveRequest[]>('/attendance/leaves');
      setLeaves(lvsRes);
    } catch {
      // silently fail
    }
  };

  useEffect(() => { loadData(); }, [selectedDate]);
  useEffect(() => { if (tab === 'leaves') loadLeaves(); }, [tab]);

  // ── Actions ──────────────────────────────────────────────────

  const handleMark = async (employeeId: string, status: string) => {
    setMarking((m) => ({ ...m, [employeeId]: true }));
    setError(null);
    try {
      const nowTime = toLocalTime();
      await post('/attendance/records', {
        employeeId,
        date: selectedDate,
        status,
        checkIn: ['present', 'late', 'half_day'].includes(status) ? nowTime : null,
      });
      showSuccess(`Marked ${status} successfully`);
      await loadData();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setMarking((m) => ({ ...m, [employeeId]: false }));
    }
  };

  const handleCheckout = async () => {
    if (!checkoutRow) return;
    setError(null);
    try {
      await patch(`/attendance/records/${checkoutRow.employeeId}/${selectedDate}/checkout`, {
        checkOut: checkoutTime,
      });
      showSuccess('Check-out time recorded');
      setCheckoutRow(null);
      await loadData();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await post('/attendance/leaves', leaveForm);
      showSuccess('Leave application submitted');
      setShowLeaveModal(false);
      loadLeaves();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleLeaveDecision = async (id: string, status: 'approved' | 'rejected') => {
    setError(null);
    try {
      await post(`/attendance/leaves/${id}/status`, { status });
      showSuccess(`Leave ${status}`);
      loadLeaves();
    } catch (e) {
      setError(errorText(e));
    }
  };

  // ── Status quick-mark button ─────────────────────────────────

  const STATUSES = [
    { key: 'present',  label: 'Present',  active: 'bg-emerald-600 text-white border-emerald-600',  base: 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300' },
    { key: 'late',     label: 'Late',     active: 'bg-amber-500 text-white border-amber-500',      base: 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300' },
    { key: 'half_day', label: '½ Day',    active: 'bg-blue-500 text-white border-blue-500',        base: 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300' },
    { key: 'absent',   label: 'Absent',   active: 'bg-rose-600 text-white border-rose-600',        base: 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:border-rose-300' },
  ];

  const employees: Employee[] = records.map((r) => ({
    id: r.employeeId, employeeCode: r.employeeCode, fullName: r.fullName,
    department: r.department, designation: r.designation,
  }));

  const isToday = selectedDate === TODAY;

  // ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('attendance.title', 'Attendance & Leave Management')}
        subtitle={t('attendance.subtitle', 'Track daily check-ins, mark attendance, view calendars and manage leave approvals')}
      >
        <button className="btn" onClick={() => setShowLeaveModal(true)}>{t('attendance.apply_leave', '+ Apply Leave')}</button>
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* KPI Cards */}
      {summary && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard title={t('attendance.total_staff', 'Total Staff')}    value={summary.totalEmployees} icon="👥" />
          <StatCard title={t('attendance.present_today', 'Present Today')}  value={summary.present}        icon="✅" badge="On duty" />
          <StatCard title={t('status.late', 'Late')}           value={summary.late}           icon="⏰" />
          <StatCard title={t('status.absent', 'Absent')}         value={summary.absent}         icon="❌" />
          <StatCard title={t('attendance.on_leave', 'On Leave')}       value={summary.on_leave}       icon="🏖️" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {([
          ['sheet', t('attendance.sheet', '📋 Daily Sheet')],
          ['calendar', t('attendance.calendar', '📅 Calendar View')],
          ['leaves', t('attendance.leaves', '🏖️ Leave Approvals')]
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === key
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Daily Attendance Sheet ──────────────────────── */}
      {tab === 'sheet' && (
        <div className="space-y-4">
          {/* Date selector */}
          <div className="card flex flex-col sm:flex-row sm:items-center gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 py-3">
            <div className="flex items-center gap-3 flex-1">
              <label className="text-sm font-semibold text-slate-700 shrink-0">📅 Date:</label>
              <input
                type="date"
                className="input max-w-[180px] py-1.5"
                value={selectedDate}
                max={TODAY}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {!isToday && (
                <button className="btn-ghost text-xs py-1 px-2.5" onClick={() => setSelectedDate(TODAY)}>
                  {t('attendance.jump_today', 'Jump to Today')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {records.length} employees loaded
            </div>
          </div>

          {/* Attendance table */}
          {loading ? (
            <div className="card flex items-center justify-center h-40 text-slate-400">Loading…</div>
          ) : records.length === 0 ? (
            <EmptyState icon="👥" title="No employees found" body="Add employees in HR & Payroll first." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block card overflow-x-auto p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="th rounded-tl-xl">{t('common.code', 'Code')}</th>
                      <th className="th">{t('common.name', 'Employee')}</th>
                      <th className="th">{t('attendance.dept', 'Dept.')}</th>
                      <th className="th text-center">{t('attendance.check_in', 'Check In')}</th>
                      <th className="th text-center">{t('attendance.check_out', 'Check Out')}</th>
                      <th className="th text-center">{t('common.status', 'Status')}</th>
                      <th className="th text-right rounded-tr-xl">{t('attendance.quick_mark', 'Quick Mark')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r) => {
                      const cur = r.status || 'absent';
                      const busy = marking[r.employeeId];
                      return (
                        <tr key={r.employeeId} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="td font-mono font-semibold text-indigo-600">{r.employeeCode}</td>
                          <td className="td">
                            <div className="font-semibold text-slate-900">{r.fullName}</div>
                            <div className="text-[11px] text-slate-400">{r.designation}</div>
                          </td>
                          <td className="td text-slate-600">{r.department}</td>
                          <td className="td text-center font-mono text-slate-700">
                            {r.checkIn ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                ↗ {r.checkIn.slice(0, 5)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="td text-center font-mono text-slate-700">
                            {r.checkOut ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                                ↙ {r.checkOut.slice(0, 5)}
                              </span>
                            ) : r.checkIn ? (
                              <button
                                className="text-xs text-indigo-600 hover:underline"
                                onClick={() => { setCheckoutRow(r); setCheckoutTime(toLocalTime()); }}
                              >
                                {t('attendance.clock_out', '+ Clock out')}
                              </button>
                            ) : '—'}
                          </td>
                          <td className="td text-center"><StatusBadge status={cur} /></td>
                          <td className="td text-right">
                            <div className="flex justify-end gap-1 flex-wrap">
                              {STATUSES.map((s) => (
                                <button
                                  key={s.key}
                                  disabled={busy}
                                  onClick={() => handleMark(r.employeeId, s.key)}
                                  className={`px-2 py-1 text-[11px] rounded-md font-semibold border transition-all ${
                                    cur === s.key ? s.active : s.base
                                  } disabled:opacity-40`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {records.map((r) => {
                  const cur = r.status || 'absent';
                  const busy = marking[r.employeeId];
                  return (
                    <div key={r.employeeId} className="card space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-indigo-500">{r.employeeCode}</span>
                            <StatusBadge status={cur} />
                          </div>
                          <p className="font-semibold text-slate-900 mt-0.5">{r.fullName}</p>
                          <p className="text-xs text-slate-500">{r.department} · {r.designation}</p>
                        </div>
                      </div>

                      {/* Times */}
                      <div className="flex gap-4 text-xs">
                        <div>
                          <span className="text-slate-400">Check-in</span>
                          <p className="font-mono font-semibold text-emerald-700 mt-0.5">
                            {r.checkIn ? `↗ ${r.checkIn.slice(0, 5)}` : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Check-out</span>
                          <p className="font-mono font-semibold text-rose-600 mt-0.5">
                            {r.checkOut
                              ? `↙ ${r.checkOut.slice(0, 5)}`
                              : r.checkIn
                              ? <button className="text-indigo-600 hover:underline" onClick={() => { setCheckoutRow(r); setCheckoutTime(toLocalTime()); }}>+ Clock out</button>
                              : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Quick mark buttons */}
                      <div className="flex gap-1.5 flex-wrap">
                        {STATUSES.map((s) => (
                          <button
                            key={s.key}
                            disabled={busy}
                            onClick={() => handleMark(r.employeeId, s.key)}
                            className={`flex-1 min-w-[60px] py-1.5 text-xs rounded-lg font-semibold border transition-all ${
                              cur === s.key ? s.active : s.base
                            } disabled:opacity-40`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: Calendar View ───────────────────────────────── */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          {/* Employee selector */}
          <div className="card flex flex-col sm:flex-row sm:items-center gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 py-3">
            <label className="text-sm font-semibold text-slate-700 shrink-0">👤 Employee:</label>
            {employees.length === 0 ? (
              <p className="text-sm text-slate-400">No employees found — add staff in HR & Payroll first.</p>
            ) : (
              <select
                className="input max-w-xs"
                value={calEmployee}
                onChange={(e) => setCalEmployee(e.target.value)}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            )}
          </div>

          {calEmployee ? (
            <div className="card">
              <MonthCalendar employeeId={calEmployee} employees={employees} company={company} />
            </div>
          ) : (
            <EmptyState icon="📅" title="Select an employee" body="Choose an employee above to view their monthly attendance calendar." />
          )}
        </div>
      )}

      {/* ── TAB 3: Leave Applications ──────────────────────────── */}
      {tab === 'leaves' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Employee</th>
                <th className="th">Type</th>
                <th className="th">Period</th>
                <th className="th hidden sm:table-cell">Reason</th>
                <th className="th text-center">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaves.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                  <td className="td">
                    <div className="font-semibold text-slate-900">{l.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{l.employeeCode}</div>
                  </td>
                  <td className="td">
                    <span className="capitalize text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      {l.leaveType}
                    </span>
                  </td>
                  <td className="td text-slate-600 text-xs whitespace-nowrap">
                    <div>{l.startDate}</div>
                    <div className="text-slate-400">→ {l.endDate}</div>
                  </td>
                  <td className="td text-slate-600 max-w-[200px] hidden sm:table-cell">
                    <p className="truncate text-sm">{l.reason}</p>
                  </td>
                  <td className="td text-center"><StatusBadge status={l.status} /></td>
                  <td className="td text-right">
                    {l.status === 'pending' ? (
                      <div className="flex gap-1.5 justify-end">
                        <button
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                          onClick={() => handleLeaveDecision(l.id, 'approved')}
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => handleLeaveDecision(l.id, 'rejected')}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="🏖️" title="No leave applications" body="Applications submitted by employees will appear here." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: Clock Out ──────────────────────────────────── */}
      {checkoutRow && (
        <Modal title={`Clock Out — ${checkoutRow.fullName}`} onClose={() => setCheckoutRow(null)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
              <p><b>Employee:</b> {checkoutRow.fullName} ({checkoutRow.employeeCode})</p>
              <p><b>Date:</b> {selectedDate}</p>
              <p><b>Checked in at:</b> {checkoutRow.checkIn ?? '—'}</p>
            </div>
            <div>
              <label className="label">Check-Out Time</label>
              <input
                type="time"
                className="input"
                value={checkoutTime}
                onChange={(e) => setCheckoutTime(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={() => setCheckoutRow(null)}>Cancel</button>
              <button className="btn" onClick={handleCheckout}>Save Check-Out</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Apply Leave ────────────────────────────────── */}
      {showLeaveModal && (
        <Modal title="Submit Leave Request" onClose={() => setShowLeaveModal(false)}>
          <form onSubmit={handleApplyLeave} className="space-y-4">
            <div>
              <label className="label">Employee</label>
              <select
                className="input"
                required
                value={leaveForm.employeeId}
                onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })}
              >
                <option value="">— Select employee —</option>
                {records.map((r) => (
                  <option key={r.employeeId} value={r.employeeId}>
                    {r.fullName} ({r.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Leave Type</label>
              <select
                className="input"
                value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
              >
                <option value="annual">🌴 Annual Leave</option>
                <option value="casual">🎭 Casual Leave</option>
                <option value="sick">🏥 Medical / Sick Leave</option>
                <option value="unpaid">💸 Unpaid Leave</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  min={leaveForm.startDate}
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Reason / Justification</label>
              <textarea
                className="input resize-none"
                rows={3}
                required
                placeholder="Reason for requesting leave…"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-ghost" onClick={() => setShowLeaveModal(false)}>Cancel</button>
              <button type="submit" className="btn">Submit Request</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
