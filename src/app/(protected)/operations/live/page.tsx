'use client';

import { useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

export default function LiveOperationsPage() {
  const { authFetch, hasRole } = useAuth();
  const [gameId, setGameId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');

  if (!hasRole('superadmin', 'operator')) {
    return <div className="card text-sm text-admin-muted">Доступ только для superadmin/operator.</div>;
  }

  const run = async (path: string) => {
    setBusy(path);
    setError(null);
    try {
      const response = await authFetch(path, {
        method: path.includes('/events/') || path.endsWith('/active-games') ? 'GET' : 'POST',
      });
      const data = await parseJsonOrThrow(response);
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка live операции');
    } finally {
      setBusy(null);
    }
  };

  const gameActions = [
    { key: 'start', label: 'Start Live' },
    { key: 'stop', label: 'Stop Live' },
    { key: 'sync-lineup', label: 'Sync Lineup' },
    { key: 'sync-events', label: 'Sync Events' },
  ];

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Live Operations</h1>
        <p className="mt-1 text-sm text-admin-muted">Управление live-трекингом и событиями матчей.</p>
      </section>

      <section className="card space-y-3">
        <input className="field" value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="game_id" />

        <div className="flex flex-wrap gap-2">
          {gameActions.map((action) => {
            const path = `/ops/live/${action.key}/${encodeURIComponent(gameId)}`;
            return (
              <button key={action.key} className="btn btn-primary" onClick={() => void run(path)} disabled={!gameId || busy !== null}>
                {busy === path ? 'Running...' : action.label}
              </button>
            );
          })}

          <button
            className="btn btn-muted"
            onClick={() => void run(`/ops/live/events/${encodeURIComponent(gameId)}`)}
            disabled={!gameId || busy !== null}
          >
            {busy === `/ops/live/events/${gameId}` ? 'Running...' : 'Get Events'}
          </button>

          <button className="btn btn-muted" onClick={() => void run('/ops/live/active-games')} disabled={busy !== null}>
            {busy === '/ops/live/active-games' ? 'Running...' : 'Active Games'}
          </button>
        </div>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-lg">Result</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-admin-line bg-[#0E172A] p-3 text-xs text-admin-muted">
          {result || 'Выполните операцию, чтобы увидеть результат.'}
        </pre>
      </section>
    </div>
  );
}
