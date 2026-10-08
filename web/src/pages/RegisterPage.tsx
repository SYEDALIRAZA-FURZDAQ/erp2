import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox } from '../components/ui';
import { errorText, post } from '../lib/api';
import { useAuth } from '../lib/auth';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function RegisterPage() {
  const { login } = useAuth();
  const [f, setF] = useState({ companyName: '', slug: '', fullName: '', email: '', password: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/register-tenant', f);
      await login(f.slug, f.email, f.password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Create your company</h1>
        <ErrorBox message={error} />
        <div>
          <label className="label">Company name</label>
          <input
            className="input"
            value={f.companyName}
            required
            onChange={(e) => {
              set('companyName', e.target.value);
              if (!slugTouched) set('slug', slugify(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="label">Company code (used to sign in)</label>
          <input
            className="input"
            value={f.slug}
            required
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value.toLowerCase());
            }}
          />
        </div>
        <div>
          <label className="label">Your name</label>
          <input className="input" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div>
          <label className="label">Password (8+ chars, letters and numbers)</label>
          <input className="input" type="password" value={f.password} onChange={(e) => set('password', e.target.value)} required autoComplete="new-password" />
        </div>
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create company'}
        </button>
        <p className="text-center text-sm text-slate-500">
          Already registered? <Link className="text-indigo-600 hover:underline" to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
