import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorBox, Modal, PageHeader } from '../components/ui';
import { api, del, errorText, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Role { id: string; name: string; description: string | null; isSystem: boolean; permissions: string[]; userCount: number }
interface Perm { key: string; label: string; module: string }

export default function RolesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canManage = can('core.roles.manage');
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<Role[]>('/roles') });
  const perms = useQuery({ queryKey: ['perms'], queryFn: () => api<Perm[]>('/roles/permissions') });
  const remove = useMutation({ mutationFn: (id: string) => del(`/roles/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }) });

  return (
    <>
      <PageHeader title="Roles & permissions">{canManage && <button className="btn" onClick={() => setEditing('new')}>New role</button>}</PageHeader>
      <ErrorBox message={roles.error ? errorText(roles.error) : remove.error ? errorText(remove.error) : null} />
      <div className="grid gap-4 md:grid-cols-2">
        {roles.data?.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{r.name} {r.isSystem && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">system</span>}</h3>
                <p className="text-sm text-slate-500">{r.description}</p>
              </div>
              <span className="text-xs text-slate-500">{r.userCount} user(s)</span>
            </div>
            <p className="mt-2 text-xs text-slate-600">{r.permissions.includes('*') ? 'All permissions' : `${r.permissions.length} permission(s)`}</p>
            {canManage && !r.isSystem && (
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn-ghost" onClick={() => { if (confirm(`Delete role "${r.name}"?`)) remove.mutate(r.id); }}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <RoleForm role={editing === 'new' ? null : editing} perms={perms.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ['roles'] }); }} />
      )}
    </>
  );
}

function RoleForm({ role, perms, onClose, onSaved }: { role: Role | null; perms: Perm[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [sel, setSel] = useState<string[]>(role?.permissions ?? []);
  const save = useMutation({
    mutationFn: () => (role ? put(`/roles/${role.id}`, { name, description, permissions: sel }) : post('/roles', { name, description, permissions: sel })),
    onSuccess: onSaved,
  });
  return (
    <Modal title={role ? 'Edit role' : 'New role'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
        <ErrorBox message={save.error ? errorText(save.error) : null} />
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className="label">Description</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div>
          <label className="label">Permissions</label>
          <div className="space-y-1">
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sel.includes(p.key)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, p.key] : s.filter((x) => x !== p.key)))} />
                {p.label} <span className="text-xs text-slate-400">{p.key}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={save.isPending}>Save</button></div>
      </form>
    </Modal>
  );
}
