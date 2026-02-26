'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type GameOption = {
  id: number;
  date: string;
  time: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  is_live: boolean;
};

export default function LiveOperationsPage() {
  const { authFetch, hasRole } = useAuth();
  const [gameId, setGameId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [games, setGames] = useState<GameOption[]>([]);

  const fetchGames = useCallback(async () => {
    try {
      const res = await authFetch('/admin/games?status=upcoming&limit=20');
      const data = await parseJsonOrThrow(res);
      const items = data.items || [];
      // Also fetch live games
      const liveRes = await authFetch('/admin/games?status=live&limit=20');
      const liveData = await parseJsonOrThrow(liveRes);
      const liveItems = (liveData.items || []).map((g: GameOption) => ({ ...g, is_live: true }));
      setGames([...liveItems, ...items]);
    } catch {
      // Silent fail — dropdown just won't populate
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchGames();
  }, [fetchGames]);

  if (!hasRole('superadmin', 'operator')) {
    return <div className="card text-sm text-admin-muted">Access denied for your role.</div>;
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
      // Refresh games list after operation
      void fetchGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live operation error');
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

  const selectedGame = games.find((g) => String(g.id) === gameId);

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Live Operations</h1>
        <p className="mt-1 text-sm text-admin-muted">Manage live match tracking and events.</p>
      </section>

      <section className="card space-y-3">
        {/* Game selector dropdown */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-admin-muted">Select Game</label>
            <select
              className="field w-full"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
            >
              <option value="">-- Select a game --</option>
              {games.filter((g) => g.is_live).length > 0 && (
                <optgroup label="Live">
                  {games
                    .filter((g) => g.is_live)
                    .map((g) => (
                      <option key={`live-${g.id}`} value={String(g.id)}>
                        {g.date} {g.time?.slice(0, 5) ?? ''} | {g.home_team_name ?? `#${g.home_team_id}`} vs {g.away_team_name ?? `#${g.away_team_id}`} [LIVE]
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label="Upcoming">
                {games
                  .filter((g) => !g.is_live)
                  .map((g) => (
                    <option key={`up-${g.id}`} value={String(g.id)}>
                      {g.date} {g.time?.slice(0, 5) ?? ''} | {g.home_team_name ?? `#${g.home_team_id}`} vs {g.away_team_name ?? `#${g.away_team_id}`}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Or enter ID</label>
            <input
              className="field w-28"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="game_id"
            />
          </div>
        </div>

        {selectedGame && (
          <div className="rounded-lg border border-admin-line bg-[#0E172A] p-2 text-xs text-admin-muted">
            {selectedGame.home_team_name} vs {selectedGame.away_team_name} | {selectedGame.date} {selectedGame.time?.slice(0, 5) ?? ''}
            {selectedGame.is_live && <span className="ml-2 rounded bg-red-600/80 px-1.5 py-0.5 text-white">LIVE</span>}
          </div>
        )}

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
          {result || 'Run an operation to see results.'}
        </pre>
      </section>
    </div>
  );
}
