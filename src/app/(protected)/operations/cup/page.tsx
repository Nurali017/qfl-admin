'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type RoundKey = '1_16' | '1_8' | '1_4' | '1_2' | 'final';

type ParticipantTeam = {
  team_id: number;
  team_name: string;
  team_logo: string | null;
};

type DrawPairResponse = {
  team1_id: number;
  team2_id: number;
  sort_order: number;
  side: string;
  is_published: boolean;
  team1: { id: number; name: string; logo_url: string | null } | null;
  team2: { id: number; name: string; logo_url: string | null } | null;
};

type CupDrawResponse = {
  id: number;
  season_id: number;
  round_key: string;
  status: string;
  pairs: DrawPairResponse[];
  created_at: string;
  updated_at: string;
};

type CupSeason = {
  id: number;
  name: string;
  frontend_code: string | null;
};

const ROUND_OPTIONS: Array<{ value: RoundKey; label: string }> = [
  { value: '1_16', label: '1/16' },
  { value: '1_8', label: '1/8' },
  { value: '1_4', label: '1/4' },
  { value: '1_2', label: '1/2' },
  { value: 'final', label: 'Финал' },
];

const SIDE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'center', label: 'Center' },
];

export default function CupOpsPage() {
  const { authFetch, hasRole } = useAuth();
  const canDraw = hasRole('superadmin', 'operator');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Meta
  const [cupSeasons, setCupSeasons] = useState<CupSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [participants, setParticipants] = useState<ParticipantTeam[]>([]);

  // Draws
  const [draws, setDraws] = useState<CupDrawResponse[]>([]);
  const [activeRound, setActiveRound] = useState<RoundKey>('1_16');

  // Add pair form
  const [newTeam1, setNewTeam1] = useState<number | null>(null);
  const [newTeam2, setNewTeam2] = useState<number | null>(null);
  const [newSide, setNewSide] = useState<string>('left');
  const [newSortOrder, setNewSortOrder] = useState<number>(1);

  const activeDraw = useMemo(
    () => draws.find((d) => d.round_key === activeRound) ?? null,
    [draws, activeRound]
  );

  const isCompleted = activeDraw?.status === 'completed';

  const publishedPairs = useMemo(
    () => (activeDraw?.pairs ?? []).filter((p) => p.is_published),
    [activeDraw]
  );

  const unpublishedPairs = useMemo(
    () => (activeDraw?.pairs ?? []).filter((p) => !p.is_published),
    [activeDraw]
  );

  // Teams used in current round
  const usedTeamIds = useMemo(() => {
    const ids = new Set<number>();
    for (const pair of activeDraw?.pairs ?? []) {
      ids.add(pair.team1_id);
      ids.add(pair.team2_id);
    }
    return ids;
  }, [activeDraw]);

  // Available teams for the "add pair" form
  const availableTeams = useMemo(
    () => participants.filter((t) => !usedTeamIds.has(t.team_id)),
    [participants, usedTeamIds]
  );

  // Auto-update sort_order based on selected side
  useEffect(() => {
    const pairs = (activeDraw?.pairs ?? []).filter((p) => p.side === newSide);
    const next = pairs.length === 0 ? 1 : Math.max(...pairs.map((p) => p.sort_order)) + 1;
    setNewSortOrder(next);
  }, [activeDraw, newSide]);

  // Load cup seasons
  const loadSeasons = useCallback(async () => {
    try {
      const resp = await authFetch('/seasons?limit=200&offset=0');
      const data = (await parseJsonOrThrow(resp)) as { items: CupSeason[] };
      const cup = data.items.filter((s) => s.frontend_code === 'cup');
      setCupSeasons(cup);
      if (cup.length > 0) {
        setSelectedSeasonId((current) => current || String(cup[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seasons');
    }
  }, [authFetch]);

  useEffect(() => {
    if (canDraw) void loadSeasons();
  }, [canDraw, loadSeasons]);

  // Load draws + participants for selected season
  const loadData = useCallback(async () => {
    if (!selectedSeasonId) return;
    setBusy(true);
    setError(null);
    try {
      const [drawsResp, participantsResp] = await Promise.all([
        authFetch(`/cup-draw/draws?season_id=${selectedSeasonId}`),
        authFetch(`/cup-draw/participants?season_id=${selectedSeasonId}`),
      ]);
      const drawsData = (await parseJsonOrThrow(drawsResp)) as { items: CupDrawResponse[] };
      const participantsData = (await parseJsonOrThrow(participantsResp)) as ParticipantTeam[];
      setDraws(drawsData.items);
      setParticipants(participantsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setBusy(false);
    }
  }, [authFetch, selectedSeasonId]);

  // Auto-load data when season changes
  useEffect(() => {
    if (selectedSeasonId) void loadData();
  }, [selectedSeasonId, loadData]);

  // Reset add-pair form when round changes
  useEffect(() => {
    setNewTeam1(null);
    setNewTeam2(null);
    setNewSide('left');
  }, [activeRound]);

  const addPair = async () => {
    if (!selectedSeasonId || !newTeam1 || !newTeam2) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await authFetch(`/cup-draw/draws/${selectedSeasonId}/${activeRound}/pairs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team1_id: newTeam1,
          team2_id: newTeam2,
          sort_order: newSortOrder,
          side: newSide,
        }),
      });
      await parseJsonOrThrow(resp);
      setSuccess('Пара добавлена');
      setNewTeam1(null);
      setNewTeam2(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить пару');
    } finally {
      setBusy(false);
    }
  };

  const publishPair = async (sortOrder: number, side: string) => {
    if (!selectedSeasonId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await authFetch(
        `/cup-draw/draws/${selectedSeasonId}/${activeRound}/pairs/${sortOrder}/publish?side=${side}`,
        { method: 'POST' }
      );
      await parseJsonOrThrow(resp);
      setSuccess(`Пара #${sortOrder} (${side}) опубликована`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать пару');
    } finally {
      setBusy(false);
    }
  };

  const deletePair = async (sortOrder: number, side: string) => {
    if (!selectedSeasonId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await authFetch(
        `/cup-draw/draws/${selectedSeasonId}/${activeRound}/pairs/${sortOrder}?side=${side}`,
        { method: 'DELETE' }
      );
      await parseJsonOrThrow(resp);
      setSuccess(`Пара #${sortOrder} (${side}) удалена`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить пару');
    } finally {
      setBusy(false);
    }
  };

  const completeDraw = async () => {
    if (!selectedSeasonId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await authFetch(`/cup-draw/draws/${selectedSeasonId}/${activeRound}/complete`, {
        method: 'POST',
      });
      await parseJsonOrThrow(resp);
      setSuccess('Жеребьёвка завершена');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось завершить жеребьёвку');
    } finally {
      setBusy(false);
    }
  };

  const teamName = (pair: DrawPairResponse, side: 'team1' | 'team2') => {
    const team = side === 'team1' ? pair.team1 : pair.team2;
    return team?.name ?? `ID ${side === 'team1' ? pair.team1_id : pair.team2_id}`;
  };

  if (!canDraw) {
    return <div className="card text-sm text-admin-muted">Доступ к жеребьёвке кубка закрыт для вашей роли.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Жеребьёвка Кубка</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Управление парами для каждого раунда Кубка (live draw).
        </p>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}
      {success ? <section className="card border-admin-line text-sm text-emerald-300">{success}</section> : null}

      {/* Season selector */}
      <section className="card">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Сезон:</label>
          {cupSeasons.length > 0 ? (
            <select
              className="field max-w-xs"
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
            >
              <option value="">Выберите сезон</option>
              {cupSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} - {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-admin-muted">Загрузка...</span>
          )}
          {busy && <span className="text-sm text-admin-muted">Загрузка...</span>}
        </div>
      </section>

      {/* Round tabs */}
      <section className="card">
        <div className="mb-4 flex flex-wrap gap-2">
          {ROUND_OPTIONS.map((opt) => {
            const draw = draws.find((d) => d.round_key === opt.value);
            const published = draw?.pairs.filter((p) => p.is_published).length ?? 0;
            const total = draw?.pairs.length ?? 0;
            const isActive = activeRound === opt.value;
            return (
              <button
                key={opt.value}
                className={`btn ${isActive ? 'btn-primary' : 'btn-muted'} relative`}
                onClick={() => setActiveRound(opt.value)}
                disabled={busy}
              >
                {opt.label}
                {draw ? (
                  <span
                    className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      draw.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}
                  >
                    {published}/{total}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Round info */}
        <div className="mb-4 rounded-lg border border-admin-line bg-[#0E172A] p-3 text-sm">
          <p>
            Раунд: <strong>{ROUND_OPTIONS.find((o) => o.value === activeRound)?.label}</strong>
          </p>
          <p>
            Статус:{' '}
            <strong>{activeDraw ? activeDraw.status : 'не создан'}</strong>
          </p>
          <p>Участников: {participants.length}</p>
        </div>

        {/* Published pairs */}
        {publishedPairs.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-emerald-300">Опубликованные пары:</h3>
            <div className="space-y-2">
              {publishedPairs.map((pair) => (
                <div
                  key={pair.sort_order}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-[#0E172A] p-3"
                >
                  <span className="w-8 text-sm font-medium text-admin-muted">#{pair.sort_order}</span>
                  <span className="text-sm text-emerald-300">&#10003;</span>
                  <span className="text-sm font-medium">{teamName(pair, 'team1')}</span>
                  <span className="text-sm text-admin-muted">vs</span>
                  <span className="text-sm font-medium">{teamName(pair, 'team2')}</span>
                  <span className="ml-2 rounded bg-admin-line/30 px-1.5 py-0.5 text-[10px] text-admin-muted">
                    {pair.side}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      published
                    </span>
                    {!isCompleted && (
                      <button
                        className="btn btn-danger text-xs"
                        onClick={() => void deletePair(pair.sort_order, pair.side)}
                        disabled={busy}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unpublished pairs */}
        {unpublishedPairs.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-yellow-300">Неопубликованные:</h3>
            <div className="space-y-2">
              {unpublishedPairs.map((pair) => (
                <div
                  key={pair.sort_order}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-500/30 bg-[#0E172A] p-3"
                >
                  <span className="w-8 text-sm font-medium text-admin-muted">#{pair.sort_order}</span>
                  <span className="text-sm font-medium">{teamName(pair, 'team1')}</span>
                  <span className="text-sm text-admin-muted">vs</span>
                  <span className="text-sm font-medium">{teamName(pair, 'team2')}</span>
                  <span className="ml-2 rounded bg-admin-line/30 px-1.5 py-0.5 text-[10px] text-admin-muted">
                    {pair.side}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <button
                      className="btn btn-primary text-xs"
                      onClick={() => void publishPair(pair.sort_order, pair.side)}
                      disabled={busy}
                    >
                      Опубликовать
                    </button>
                    <button
                      className="btn btn-danger text-xs"
                      onClick={() => void deletePair(pair.sort_order, pair.side)}
                      disabled={busy}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add pair form */}
        {!isCompleted && (
          <div className="rounded-lg border border-admin-line bg-[#0E172A] p-3">
            <h3 className="mb-3 text-sm font-medium">Добавить пару:</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-admin-muted">Команда 1</label>
                <select
                  className="field max-w-[200px]"
                  value={newTeam1 ?? ''}
                  onChange={(e) => setNewTeam1(e.target.value ? Number(e.target.value) : null)}
                  disabled={busy}
                >
                  <option value="">Выберите</option>
                  {availableTeams.map((t) => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.team_name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="pb-2 text-sm text-admin-muted">vs</span>
              <div>
                <label className="mb-1 block text-xs text-admin-muted">Команда 2</label>
                <select
                  className="field max-w-[200px]"
                  value={newTeam2 ?? ''}
                  onChange={(e) => setNewTeam2(e.target.value ? Number(e.target.value) : null)}
                  disabled={busy}
                >
                  <option value="">Выберите</option>
                  {availableTeams
                    .filter((t) => t.team_id !== newTeam1)
                    .map((t) => (
                      <option key={t.team_id} value={t.team_id}>
                        {t.team_name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-admin-muted">Сторона</label>
                <select
                  className="field max-w-[120px]"
                  value={newSide}
                  onChange={(e) => setNewSide(e.target.value)}
                  disabled={busy}
                >
                  {SIDE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-admin-muted">Позиция</label>
                <input
                  type="number"
                  className="field w-16"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(Math.max(1, Number(e.target.value) || 1))}
                  min={1}
                  disabled={busy}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => void addPair()}
                disabled={busy || !newTeam1 || !newTeam2}
              >
                + Добавить
              </button>
            </div>
          </div>
        )}

        {/* Complete draw */}
        <div className="mt-4">
          {isCompleted ? (
            <p className="text-sm text-emerald-300">
              Жеребьёвка завершена. Добавление новых пар недоступно.
            </p>
          ) : activeDraw ? (
            <button
              className="btn btn-danger"
              onClick={() => void completeDraw()}
              disabled={busy || (activeDraw?.pairs.length ?? 0) === 0}
            >
              Завершить жеребьёвку
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
