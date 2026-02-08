'use client';

import { useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

const SYNC_ACTIONS = [
  { key: 'full', label: 'Full Sync', needsSeason: true },
  { key: 'games', label: 'Games', needsSeason: true },
  { key: 'teams', label: 'Teams', needsSeason: false },
  { key: 'team-logos', label: 'Team Logos', needsSeason: false },
  { key: 'players', label: 'Players', needsSeason: true },
  { key: 'score-table', label: 'Score Table', needsSeason: true },
  { key: 'team-season-stats', label: 'Team Season Stats', needsSeason: true },
  { key: 'player-season-stats', label: 'Player Season Stats', needsSeason: true },
] as const;

const GAME_ACTIONS = [
  { key: 'game-stats', label: 'Game Stats' },
  { key: 'game-lineup', label: 'Game Lineup' },
  { key: 'game-events', label: 'Game Events' },
] as const;

export default function SyncOperationsPage() {
  const { authFetch, hasRole } = useAuth();
  const [seasonId, setSeasonId] = useState('61');
  const [gameId, setGameId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!hasRole('superadmin', 'operator')) {
    return <div className="card text-sm text-admin-muted">Доступ только для superadmin/operator.</div>;
  }

  const runAction = async (path: string) => {
    setBusy(path);
    setError(null);
    try {
      const response = await authFetch(path, { method: 'POST' });
      const data = await parseJsonOrThrow(response);
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запуска операции');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Sync Operations</h1>
        <p className="mt-1 text-sm text-admin-muted">Ручной запуск sync-операций backend.</p>
      </section>

      <section className="card">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="field" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} placeholder="season_id" />
          <input className="field" value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="game_id (для game actions)" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SYNC_ACTIONS.map((action) => {
            const query = action.needsSeason ? `?season_id=${encodeURIComponent(seasonId)}` : '';
            const path = `/ops/sync/${action.key}${query}`;
            return (
              <button key={action.key} className="btn btn-muted" onClick={() => void runAction(path)} disabled={busy !== null}>
                {busy === path ? 'Running...' : action.label}
              </button>
            );
          })}

          {GAME_ACTIONS.map((action) => {
            const path = `/ops/sync/${action.key}/${encodeURIComponent(gameId)}`;
            return (
              <button key={action.key} className="btn btn-primary" onClick={() => void runAction(path)} disabled={busy !== null || !gameId.trim()}>
                {busy === path ? 'Running...' : action.label}
              </button>
            );
          })}

          <button
            className="btn btn-primary"
            onClick={() => {
              const path = `/ops/sync/all-game-events?season_id=${encodeURIComponent(seasonId)}`;
              void runAction(path);
            }}
            disabled={busy !== null}
          >
            {busy?.startsWith('/ops/sync/all-game-events') ? 'Running...' : 'All Game Events'}
          </button>
        </div>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-lg">Result</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-admin-line bg-[#0E172A] p-3 text-xs text-admin-muted">
          {result || 'Запустите любую операцию, чтобы увидеть ответ.'}
        </pre>
      </section>
    </div>
  );
}
