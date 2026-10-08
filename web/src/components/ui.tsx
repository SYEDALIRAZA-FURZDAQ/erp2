import { ReactNode } from 'react';
import { useTranslation } from '../lib/i18n';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl leading-tight truncate">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 truncate">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm flex items-start gap-2">
      <span className="font-semibold text-red-800 shrink-0">{t('common.error', 'Error')}:</span>
      <span>{message}</span>
    </div>
  );
}

export function SuccessBox({ message }: { message: string | null }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 shadow-sm flex items-start gap-2">
      <span className="font-semibold text-emerald-900 shrink-0">{t('common.success', 'Success')}:</span>
      <span>{message}</span>
    </div>
  );
}

export function Modal({
  title,
  maxWidth = 'max-w-lg',
  onClose,
  children,
}: {
  title: string;
  maxWidth?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      {/* On mobile: sheet slides up from bottom; on sm+: centered dialog */}
      <div
        className={`
          w-full rounded-t-2xl sm:rounded-xl
          max-h-[92vh] sm:max-h-[90vh]
          ${maxWidth}
          bg-white shadow-2xl overflow-y-auto
          transition-all
        `}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile hint */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 pb-5 pt-3">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 leading-tight">{title}</h2>
            <button
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-slate-500">
        {total} {t('common.records', 'record(s)')}
      </span>
      <div className="flex items-center gap-2">
        <button className="btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('common.previous', 'Previous')}
        </button>
        <span className="text-xs font-medium text-slate-700 px-1">
          {t('common.page', 'Page')} {page} / {pages}
        </span>
        <button className="btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t('common.next', 'Next')}
        </button>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const s = status.toLowerCase();
  let color = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['active', 'posted', 'paid', 'approved', 'received', 'completed', 'done', 'reported', 'present'].includes(s)) {
    color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['draft', 'planning', 'todo', 'pending'].includes(s)) {
    color = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['in_progress', 'review', 'half_day'].includes(s)) {
    color = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['cancelled', 'rejected', 'declined', 'reversed', 'void', 'failed', 'terminated', 'absent'].includes(s)) {
    color = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['late', 'on_hold'].includes(s)) {
    color = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['on_leave'].includes(s)) {
    color = 'bg-purple-50 text-purple-700 border-purple-200';
  }

  const translatedLabel = t(`status.${s}`, status.replace(/_/g, ' '));

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${color}`}
    >
      {translatedLabel}
    </span>
  );
}

export function StatCard({
  title,
  value,
  subtext,
  icon,
  badge,
}: {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  badge?: string;
}) {
  return (
    <div className="card relative overflow-hidden transition-all hover:shadow-md active:scale-[0.98]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{title}</p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl leading-tight truncate">
            {value}
          </p>
          {subtext && <p className="mt-0.5 text-xs text-slate-500 truncate">{subtext}</p>}
        </div>
        {icon && <span className="text-xl sm:text-2xl shrink-0">{icon}</span>}
      </div>
      {badge && <div className="mt-2 text-xs font-medium text-indigo-600 truncate">{badge}</div>}
    </div>
  );
}

/** Responsive table wrapper — scrolls horizontally on narrow screens */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="table-wrap">
      {children}
    </div>
  );
}

/** Mobile-friendly empty state */
export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="font-semibold text-slate-700">{title}</p>
      {body && <p className="mt-1 text-sm text-slate-500 max-w-xs">{body}</p>}
    </div>
  );
}
