import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox } from '../components/ui';
import { errorText } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [tenant, setTenant] = useState(localStorage.getItem('erp_tenant') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(tenant.trim().toLowerCase(), email.trim(), password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <ErrorBox message={error} />
        <div>
          <label className="label">Company code</label>
          <input className="input" value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="e.g. acme-traders" required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-slate-500">
          New company? <Link className="text-indigo-600 hover:underline" to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
