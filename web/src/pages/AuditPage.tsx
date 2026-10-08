import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { ErrorBox, PageHeader, Pager } from '../components/ui';
import { api, errorText } from '../lib/api';

interface Row { id: number; action: string; entity: string; entityId: string | null; userName: string | null; ip: string | null; createdAt: string; oldValue: unknown; newValue: unknown }

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ['audit', page, entity],
    queryFn: () => api<{ items: Row[]; total: number; pageSize: number }>(`/audit?page=${page}${entity ? `&entity=${encodeURIComponent(entity)}` : ''}`),
  });
  return (
    <>
      <PageHeader title="Audit log" />
      <input className="input mb-3 max-w-xs" placeholder="Filter by entity (user, role, company…)" value={entity} onChange={(e) => { setEntity(e.target.value.trim()); setPage(1); }} />
      <ErrorBox message={q.error ? errorText(q.error) : null} />
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead><tr><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Entity</th><th className="th">IP</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {q.data?.items.map((r) => (
              <Fragment key={r.id}>
                <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td className="td whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="td">{r.userName ?? '—'}</td>
                  <td className="td font-mono text-xs">{r.action}</td>
                  <td className="td">{r.entity}</td>
                  <td className="td text-slate-500">{r.ip}</td>
                </tr>
                {open === r.id && (
                  <tr>
                    <td colSpan={5} className="bg-slate-50 px-3 py-2">
                      <pre className="overflow-x-auto text-xs">{JSON.stringify({ old: r.oldValue, new: r.newValue }, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {q.data && <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </>
  );
}
