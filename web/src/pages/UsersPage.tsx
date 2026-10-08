import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { ErrorBox, Modal, PageHeader, Pager } from '../components/ui';
import { api, errorText, patch, post } from '../lib/api';
import { useAuth } from '../lib/auth';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isOwner: boolean;
  lastLoginAt: string | null;
  roles: { id: string; name: string }[];
}
interface RoleRow {
  id: string;
  name: string;
}

export default function UsersPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const canManage = can('core.users.manage');

  const users = useQuery({
    queryKey: ['users', page, q],
    queryFn: () => api<{ items: UserRow[]; total: number; pageSize: number }>(`/users?page=${page}&q=${encodeURIComponent(q)}`),
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<RoleRow[]>('/roles'), enabled: can('core.roles.read') });

  const toggle = useMutation({
    mutationFn: (u: UserRow) => patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <>
      <PageHeader title="Users">
        {canManage && (
          <button className="btn" onClick={() => setEditing('new')}>
            Add user
          </button>
        )}
      </PageHeader>
      <input className="input mb-3 max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <ErrorBox message={users.error ? errorText(users.error) : toggle.error ? errorText(toggle.error) : null} />
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              <th className="th">Name</th><th className="th">Email</th><th className="th">Roles</th><th className="th">Status</th><th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.data?.items.map((u) => (
              <tr key={u.id}>
                <td className="td font-medium">{u.fullName}</td>
                <td className="td">{u.email}</td>
                <td className="td">{u.roles.map((r) => r.name).join(', ') || '—'}</td>
                <td className="td">{u.isActive ? 'Active' : <span className="text-red-600">Disabled</span>}</td>
                <td className="td space-x-2 text-right">
                  {canManage && (
                    <>
                      <button className="btn-ghost" onClick={() => setEditing(u)}>Edit</button>
                      <button className="btn-ghost" onClick={() => setResetFor(u)}>Reset password</button>
                      {!u.isOwner && (
                        <button className="btn-ghost" onClick={() => toggle.mutate(u)}>{u.isActive ? 'Disable' : 'Enable'}</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.data && <Pager page={page} pageSize={users.data.pageSize} total={users.data.total} onPage={setPage} />}

      {editing && <UserForm user={editing === 'new' ? null : editing} roles={roles.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ['users'] }); }} />}
      {resetFor && <ResetForm user={resetFor} onClose={() => setResetFor(null)} />}
    </>
  );
}

function UserForm({ user, roles, onClose, onSaved }: { user: UserRow | null; roles: RoleRow[]; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>(user?.roles.map((r) => r.id) ?? []);
  const save = useMutation({
    mutationFn: () => (user ? patch(`/users/${user.id}`, { fullName, roleIds }) : post('/users', { email, fullName, password, roleIds })),
    onSuccess: onSaved,
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Modal title={user ? 'Edit user' : 'Add user'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox message={save.error ? errorText(save.error) : null} />
        <div><label className="label">Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
        {!user && (
          <>
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label className="label">Initial password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></div>
          </>
        )}
        <div>
          <label className="label">Roles</label>
          <div className="space-y-1">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roleIds.includes(r.id)} onChange={(e) => setRoleIds((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} />
                {r.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetForm({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const save = useMutation({ mutationFn: () => post(`/users/${user.id}/reset-password`, { password }), onSuccess: onClose });
  return (
    <Modal title={`Reset password: ${user.fullName}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
        <ErrorBox message={save.error ? errorText(save.error) : null} />
        <div><label className="label">New password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></div>
        <p className="text-xs text-slate-500">All of this user's active sessions will be signed out.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={save.isPending}>Reset</button></div>
      </form>
    </Modal>
  );
}
