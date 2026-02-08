'use client';

import { FormEvent, useState } from 'react';

import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.2em] text-admin-muted">QFL Admin</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-2xl font-semibold text-admin-text">Вход</h1>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs text-admin-muted">Email</span>
            <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-admin-muted">Password</span>
            <input
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>

          {error ? <div className="rounded-lg border border-admin-danger/50 bg-admin-danger/10 p-2 text-sm">{error}</div> : null}

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
