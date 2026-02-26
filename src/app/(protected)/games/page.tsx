'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type GameItem = {
  id: number;
  date: string;
  time: string | null;
  tour: number | null;
  season_id: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  is_live: boolean;
  has_lineup: boolean;
  has_stats: boolean;
  stadium: string | null;
  home_formation: string | null;
  away_formation: string | null;
  sota_id: string | null;
};

type GamesResponse = { items: GameItem[]; total: number };

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live' },
  { value: 'finished', label: 'Finished' },
];

export default function GamesPage() {
  const { authFetch, hasRole } = useAuth();

  const [games, setGames] = useState<GameItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seasonId, setSeasonId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;

  // Live/sync operation state
  const [busy, setBusy] = useState<string | null>(null);
  const [opResult, setOpResult] = useState<string>('');

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (seasonId) params.set('season_id', seasonId);
      if (status) params.set('status', status);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));

      const res = await authFetch(`/admin/games?${params.toString()}`);
      const data: GamesResponse = await parseJsonOrThrow(res);
      setGames(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, [authFetch, seasonId, status, page]);

  useEffect(() => {
    void fetchGames();
  }, [fetchGames]);

  const runOp = async (path: string, method = 'POST') => {
    setBusy(path);
    setOpResult('');
    try {
      const res = await authFetch(path, { method });
      const data = await parseJsonOrThrow(res);
      setOpResult(JSON.stringify(data, null, 2));
      // Refresh game list after operation
      void fetchGames();
    } catch (err) {
      setOpResult(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusy(null);
    }
  };

  if (!hasRole('superadmin', 'editor', 'operator')) {
    return <div className="card text-sm text-admin-muted">Access denied.</div>;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Games</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Manage matches: view, filter, edit scores, start/stop live, sync data.
        </p>
      </section>

      {/* Filters */}
      <section className="card">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Season ID</label>
            <input
              className="field w-28"
              value={seasonId}
              onChange={(e) => { setSeasonId(e.target.value); setPage(0); }}
              placeholder="All"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Status</label>
            <select
              className="field w-32"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-muted" onClick={() => void fetchGames()} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </section>

      {error && <section className="card border-admin-danger text-sm text-red-100">{error}</section>}

      {/* Games Table */}
      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-admin-line text-left text-xs uppercase text-admin-muted">
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Home</th>
              <th className="px-2 py-2">Away</th>
              <th className="px-2 py-2">Score</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-b border-admin-line/50 hover:bg-[#192640]/50">
                <td className="px-2 py-2 font-mono text-xs">{g.id}</td>
                <td className="px-2 py-2">{g.date}</td>
                <td className="px-2 py-2">{g.time?.slice(0, 5) ?? '-'}</td>
                <td className="px-2 py-2">{g.home_team_name ?? `#${g.home_team_id}`}</td>
                <td className="px-2 py-2">{g.away_team_name ?? `#${g.away_team_id}`}</td>
                <td className="px-2 py-2 font-mono">
                  {g.home_score !== null ? `${g.home_score} : ${g.away_score}` : '-'}
                </td>
                <td className="px-2 py-2">
                  {g.is_live ? (
                    <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-xs font-medium text-white">LIVE</span>
                  ) : g.home_score !== null ? (
                    <span className="rounded bg-admin-line px-1.5 py-0.5 text-xs text-admin-muted">FT</span>
                  ) : (
                    <span className="rounded bg-admin-line/50 px-1.5 py-0.5 text-xs text-admin-muted">-</span>
                  )}
                  {g.has_lineup && <span className="ml-1 text-xs text-green-400" title="Has lineup">L</span>}
                  {g.has_stats && <span className="ml-1 text-xs text-blue-400" title="Has stats">S</span>}
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {!g.is_live ? (
                      <button
                        className="rounded bg-green-700/70 px-2 py-0.5 text-xs text-white hover:bg-green-600"
                        disabled={busy !== null}
                        onClick={() => void runOp(`/ops/live/start/${g.id}`)}
                      >
                        {busy === `/ops/live/start/${g.id}` ? '...' : 'Start'}
                      </button>
                    ) : (
                      <button
                        className="rounded bg-red-700/70 px-2 py-0.5 text-xs text-white hover:bg-red-600"
                        disabled={busy !== null}
                        onClick={() => void runOp(`/ops/live/stop/${g.id}`)}
                      >
                        {busy === `/ops/live/stop/${g.id}` ? '...' : 'Stop'}
                      </button>
                    )}
                    <button
                      className="rounded bg-admin-line px-2 py-0.5 text-xs text-admin-muted hover:bg-[#2a3a5c]"
                      disabled={busy !== null}
                      onClick={() => void runOp(`/ops/live/sync-lineup/${g.id}`)}
                      title="Sync lineup"
                    >
                      {busy === `/ops/live/sync-lineup/${g.id}` ? '...' : 'Lineup'}
                    </button>
                    <button
                      className="rounded bg-admin-line px-2 py-0.5 text-xs text-admin-muted hover:bg-[#2a3a5c]"
                      disabled={busy !== null}
                      onClick={() => void runOp(`/ops/live/sync-events/${g.id}`)}
                      title="Sync events"
                    >
                      {busy === `/ops/live/sync-events/${g.id}` ? '...' : 'Events'}
                    </button>
                    <button
                      className="rounded bg-admin-line px-2 py-0.5 text-xs text-admin-muted hover:bg-[#2a3a5c]"
                      disabled={busy !== null}
                      onClick={() => void runOp(`/ops/sync/game-stats/${g.id}`)}
                      title="Sync game stats"
                    >
                      {busy === `/ops/sync/game-stats/${g.id}` ? '...' : 'Stats'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {games.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-admin-muted">No games found.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-admin-muted">
            <span>
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                className="btn btn-muted px-2 py-1 text-xs"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <button
                className="btn btn-muted px-2 py-1 text-xs"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Operation result */}
      {opResult && (
        <section className="card">
          <h2 className="font-[var(--font-heading)] text-lg">Operation Result</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-admin-line bg-[#0E172A] p-3 text-xs text-admin-muted">
            {opResult}
          </pre>
        </section>
      )}
    </div>
  );
}
