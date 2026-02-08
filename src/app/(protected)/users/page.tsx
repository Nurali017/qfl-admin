'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';
import type { AdminRole } from '@/lib/types';

type AdminUserRow = {
  id: number;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function UsersPage() {
  const { authFetch, hasRole } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('editor');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/users');
      const data = (await parseJsonOrThrow(response)) as AdminUserRow[];
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (hasRole('superadmin')) {
      void loadUsers();
    }
  }, [hasRole, loadUsers]);

  if (!hasRole('superadmin')) {
    return <div className="card text-sm text-admin-muted">Раздел доступен только superadmin.</div>;
  }

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await authFetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, is_active: true }),
      });
      await parseJsonOrThrow(response);
      setEmail('');
      setPassword('');
      setRole('editor');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать пользователя');
    }
  };

  const updateUser = async (userId: number, payload: Partial<Pick<AdminUserRow, 'role' | 'is_active' | 'email'>>) => {
    const response = await authFetch(`/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await parseJsonOrThrow(response);
    await loadUsers();
  };

  const resetPassword = async (userId: number) => {
    const value = prompt('Новый пароль:');
    if (!value) {
      return;
    }

    const response = await authFetch(`/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: value }),
    });
    await parseJsonOrThrow(response);
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Admin Users</h1>
        <p className="mt-1 text-sm text-admin-muted">Создание пользователей и управление ролями.</p>
      </section>

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">Новый пользователь</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto]" onSubmit={createUser}>
          <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" required />
          <input
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
            required
          />
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            <option value="editor">editor</option>
            <option value="operator">operator</option>
            <option value="superadmin">superadmin</option>
          </select>
          <button className="btn btn-primary" type="submit">
            Create
          </button>
        </form>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      <section className="card overflow-x-auto">
        {loading ? <p className="text-sm text-admin-muted">Загружаем пользователей...</p> : null}
        {!loading && users.length === 0 ? <p className="text-sm text-admin-muted">Пользователей нет.</p> : null}

        {!loading && users.length > 0 ? (
          <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-admin-muted">
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="bg-[#0E172A]">
                  <td className="px-2 py-2">{user.id}</td>
                  <td className="px-2 py-2">{user.email}</td>
                  <td className="px-2 py-2">
                    <select
                      className="field"
                      value={user.role}
                      onChange={(e) => void updateUser(user.id, { role: e.target.value as AdminRole })}
                    >
                      <option value="editor">editor</option>
                      <option value="operator">operator</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <label className="inline-flex items-center gap-2 text-xs text-admin-muted">
                      <input
                        type="checkbox"
                        checked={user.is_active}
                        onChange={(e) => void updateUser(user.id, { is_active: e.target.checked })}
                      />
                      {user.is_active ? 'active' : 'inactive'}
                    </label>
                  </td>
                  <td className="px-2 py-2 text-xs text-admin-muted">{new Date(user.created_at).toLocaleString()}</td>
                  <td className="px-2 py-2">
                    <button className="btn btn-muted" type="button" onClick={() => void resetPassword(user.id)}>
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
