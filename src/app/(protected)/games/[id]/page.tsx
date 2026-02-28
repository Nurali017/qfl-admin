'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Combobox from '@/components/Combobox';
import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type GameDetail = {
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
  home_penalty_score: number | null;
  away_penalty_score: number | null;
  status: string;
  is_featured: boolean;
  sync_disabled: boolean;
  has_lineup: boolean;
  has_stats: boolean;
  video_url: string | null;
  youtube_live_url: string | null;
};

type LineupItem = {
  id: number;
  player_id: number;
  player_name: string | null;
  team_id: number;
  lineup_type: string;
  shirt_number: number | null;
  is_captain: boolean;
  amplua: string | null;
  field_position: string | null;
};

type EventItem = {
  id: number;
  half: number;
  minute: number;
  event_type: string;
  team_id: number | null;
  player_id: number | null;
  player_name: string | null;
  player_number: number | null;
  player2_id: number | null;
  player2_name: string | null;
  assist_player_id: number | null;
  assist_player_name: string | null;
};

type PlayerOption = { id: number; name: string; number?: number | null };

type RefereeItem = {
  id: number;
  referee_id: number;
  referee_name: string | null;
  role: string;
};

type RefereeOption = { id: number; name: string };

const STATUS_OPTIONS = ['created', 'live', 'finished', 'postponed', 'cancelled', 'technical_defeat'];

const REFEREE_ROLES = [
  { value: 'main', label: 'Main Referee' },
  { value: 'first_assistant', label: '1st Assistant' },
  { value: 'second_assistant', label: '2nd Assistant' },
  { value: 'fourth_referee', label: '4th Referee' },
  { value: 'var_main', label: 'VAR Main' },
  { value: 'var_assistant', label: 'VAR Assistant' },
  { value: 'match_inspector', label: 'Match Inspector' },
];
const LINEUP_TYPES = ['starter', 'substitute'];
const AMPLUA_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Gk', label: 'Gk — вратарь' },
  { value: 'D', label: 'D — защитник' },
  { value: 'DM', label: 'DM — опорный' },
  { value: 'M', label: 'M — полузащитник' },
  { value: 'AM', label: 'AM — атак. полузащитник' },
  { value: 'F', label: 'F — нападающий' },
];
const FIELD_POSITION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'C', label: 'C — центр' },
  { value: 'L', label: 'L — левый' },
  { value: 'R', label: 'R — правый' },
  { value: 'LC', label: 'LC — левый центр' },
  { value: 'RC', label: 'RC — правый центр' },
];
const EVENT_TYPES = ['goal', 'own_goal', 'penalty', 'missed_penalty', 'yellow_card', 'second_yellow', 'red_card', 'substitution', 'assist'];
const SCORE_EVENT_TYPES = ['goal', 'own_goal', 'penalty'];

const EVENT_CONFIG: Record<string, {
  playerLabel: string;
  playerFrom: 'team' | 'opposite' | 'starters';
  showAssist: boolean;
  showPlayer2: boolean;
  player2Label?: string;
}> = {
  goal:           { playerLabel: 'Scorer',       playerFrom: 'team',     showAssist: true,  showPlayer2: false },
  own_goal:       { playerLabel: 'Player',        playerFrom: 'opposite', showAssist: false, showPlayer2: false },
  penalty:        { playerLabel: 'Taker',         playerFrom: 'team',     showAssist: false, showPlayer2: false },
  missed_penalty: { playerLabel: 'Taker',         playerFrom: 'team',     showAssist: false, showPlayer2: false },
  yellow_card:    { playerLabel: 'Player',        playerFrom: 'team',     showAssist: false, showPlayer2: false },
  second_yellow:  { playerLabel: 'Player',        playerFrom: 'team',     showAssist: false, showPlayer2: false },
  red_card:       { playerLabel: 'Player',        playerFrom: 'team',     showAssist: false, showPlayer2: false },
  substitution:   { playerLabel: 'Out (стартер)', playerFrom: 'starters', showAssist: false, showPlayer2: true, player2Label: 'In (замена)' },
  assist:         { playerLabel: 'Player',        playerFrom: 'team',     showAssist: false, showPlayer2: false },
};

export default function GameDetailPage({ params }: { params: { id: string } }) {
  const gameId = Number(params.id);
  const { authFetch, hasRole } = useAuth();

  // Game state
  const [game, setGame] = useState<GameDetail | null>(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);

  // Edit form state
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editHomeScore, setEditHomeScore] = useState('');
  const [editAwayScore, setEditAwayScore] = useState('');
  const [editHomePenalty, setEditHomePenalty] = useState('');
  const [editAwayPenalty, setEditAwayPenalty] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editFeatured, setEditFeatured] = useState(false);
  const [editSyncDisabled, setEditSyncDisabled] = useState(false);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editYoutubeLiveUrl, setEditYoutubeLiveUrl] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Lineup state
  const [lineup, setLineup] = useState<LineupItem[]>([]);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [lineupBusy, setLineupBusy] = useState(false);

  // Lineup add form
  const [addLineupTeam, setAddLineupTeam] = useState<'home' | 'away'>('home');
  const [addLineupPlayers, setAddLineupPlayers] = useState<PlayerOption[]>([]);
  const [addLineupPlayer, setAddLineupPlayer] = useState('');
  const [addLineupType, setAddLineupType] = useState('starter');
  const [addLineupNumber, setAddLineupNumber] = useState('');
  const [addLineupAmplua, setAddLineupAmplua] = useState('');
  const [addLineupFieldPosition, setAddLineupFieldPosition] = useState('');
  const [addLineupCaptain, setAddLineupCaptain] = useState(false);
  const [addLineupMsg, setAddLineupMsg] = useState('');

  // Referees state
  const [referees, setReferees] = useState<RefereeItem[]>([]);
  const [refereesLoading, setRefereesLoading] = useState(false);
  const [refereesError, setRefereesError] = useState<string | null>(null);
  const [refereesBusy, setRefereesBusy] = useState(false);

  // Referee add form
  const [addRefReferee, setAddRefReferee] = useState('');
  const [addRefRole, setAddRefRole] = useState('main');
  const [addRefMsg, setAddRefMsg] = useState('');
  const [refereeOptions, setRefereeOptions] = useState<RefereeOption[]>([]);

  // Events state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsBusy, setEventsBusy] = useState(false);

  // Event add form
  const [addEvtHalf, setAddEvtHalf] = useState('1');
  const [addEvtMinute, setAddEvtMinute] = useState('');
  const [addEvtType, setAddEvtType] = useState('goal');
  const [addEvtTeam, setAddEvtTeam] = useState<'home' | 'away' | ''>('');
  const [addEvtPlayerId, setAddEvtPlayerId] = useState('');
  const [addEvtPlayer2Id, setAddEvtPlayer2Id] = useState('');
  const [addEvtAssistId, setAddEvtAssistId] = useState('');
  const [addEvtMsg, setAddEvtMsg] = useState('');

  // Fetch game
  const fetchGame = useCallback(async () => {
    setGameLoading(true);
    setGameError(null);
    try {
      const res = await authFetch(`/games/${gameId}`);
      const data: GameDetail = await parseJsonOrThrow(res);
      setGame(data);
      setEditDate(data.date ?? '');
      setEditTime(data.time?.slice(0, 5) ?? '');
      setEditHomeScore(data.home_score !== null ? String(data.home_score) : '');
      setEditAwayScore(data.away_score !== null ? String(data.away_score) : '');
      setEditHomePenalty(data.home_penalty_score !== null ? String(data.home_penalty_score) : '');
      setEditAwayPenalty(data.away_penalty_score !== null ? String(data.away_penalty_score) : '');
      setEditStatus(data.status);
      setEditFeatured(data.is_featured);
      setEditSyncDisabled(data.sync_disabled ?? false);
      setEditVideoUrl(data.video_url ?? '');
      setEditYoutubeLiveUrl(data.youtube_live_url ?? '');
    } catch (err) {
      setGameError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setGameLoading(false);
    }
  }, [authFetch, gameId]);

  // Fetch lineup
  const fetchLineup = useCallback(async () => {
    setLineupLoading(true);
    setLineupError(null);
    try {
      const res = await authFetch(`/games/${gameId}/lineup`);
      const data: LineupItem[] = await parseJsonOrThrow(res);
      setLineup(data);
    } catch (err) {
      setLineupError(err instanceof Error ? err.message : 'Failed to load lineup');
    } finally {
      setLineupLoading(false);
    }
  }, [authFetch, gameId]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await authFetch(`/games/${gameId}/events`);
      const data: EventItem[] = await parseJsonOrThrow(res);
      setEvents(data);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setEventsLoading(false);
    }
  }, [authFetch, gameId]);

  // Fetch referees
  const fetchReferees = useCallback(async () => {
    setRefereesLoading(true);
    setRefereesError(null);
    try {
      const res = await authFetch(`/games/${gameId}/referees`);
      const data: RefereeItem[] = await parseJsonOrThrow(res);
      setReferees(data);
    } catch (err) {
      setRefereesError(err instanceof Error ? err.message : 'Failed to load referees');
    } finally {
      setRefereesLoading(false);
    }
  }, [authFetch, gameId]);

  useEffect(() => {
    void fetchGame();
    void fetchLineup();
    void fetchReferees();
    void fetchEvents();
  }, [fetchGame, fetchLineup, fetchReferees, fetchEvents]);

  // Load referee options
  useEffect(() => {
    void authFetch('/games/referees/search?limit=200').then(async (res) => {
      try {
        const data = await res.json();
        setRefereeOptions(data);
      } catch {}
    });
  }, [authFetch]);

  // Load players when lineup team changes
  useEffect(() => {
    if (!game) return;
    const teamId = addLineupTeam === 'home' ? game.home_team_id : game.away_team_id;
    if (!teamId) return;
    void authFetch(`/teams/${teamId}/players?season_id=${game.season_id ?? ''}`).then(async (res) => {
      try {
        const data = await res.json();
        setAddLineupPlayers((data.items ?? []).map((p: { id: number; first_name?: string; last_name?: string; number?: number | null }) => ({
          id: p.id,
          name: [p.last_name, p.first_name].filter(Boolean).join(' '),
          number: p.number ?? null,
        })));
        setAddLineupPlayer('');
      } catch {}
    });
  }, [authFetch, game, addLineupTeam]);

  // Reset event player fields when event type changes
  useEffect(() => {
    setAddEvtPlayerId('');
    setAddEvtPlayer2Id('');
    setAddEvtAssistId('');
  }, [addEvtType]);

  // Save game changes
  const saveGame = async () => {
    setSaveLoading(true);
    setSaveMsg('');
    try {
      const body: Record<string, unknown> = {
        ...(editDate && { date: editDate }),
        time: editTime || null,
        home_score: editHomeScore !== '' ? Number(editHomeScore) : null,
        away_score: editAwayScore !== '' ? Number(editAwayScore) : null,
        home_penalty_score: editHomePenalty !== '' ? Number(editHomePenalty) : null,
        away_penalty_score: editAwayPenalty !== '' ? Number(editAwayPenalty) : null,
        status: editStatus,
        is_featured: editFeatured,
        sync_disabled: editSyncDisabled,
        video_url: editVideoUrl || null,
        youtube_live_url: editYoutubeLiveUrl || null,
      };
      const res = await authFetch(`/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await parseJsonOrThrow(res);
      setSaveMsg('Saved!');
      void fetchGame();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  };

  // Reset to not started
  const resetStatus = async () => {
    setSaveLoading(true);
    setSaveMsg('');
    try {
      const res = await authFetch(`/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'created' }),
      });
      await parseJsonOrThrow(res);
      setSaveMsg('Reset to Not Started!');
      void fetchGame();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSaveLoading(false);
    }
  };

  // Delete lineup entry
  const deleteLineup = async (lineupId: number) => {
    setLineupBusy(true);
    try {
      const res = await authFetch(`/games/${gameId}/lineup/${lineupId}`, { method: 'DELETE' });
      await parseJsonOrThrow(res);
      void fetchLineup();
    } catch (err) {
      setLineupError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLineupBusy(false);
    }
  };

  // Add lineup entry
  const addLineup = async () => {
    if (!addLineupPlayer || !game) return;
    setLineupBusy(true);
    setAddLineupMsg('');
    try {
      const teamId = addLineupTeam === 'home' ? game.home_team_id : game.away_team_id;
      const res = await authFetch(`/games/${gameId}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: Number(addLineupPlayer),
          team_id: teamId,
          lineup_type: addLineupType,
          shirt_number: addLineupNumber !== '' ? Number(addLineupNumber) : null,
          amplua: addLineupAmplua || null,
          field_position: addLineupFieldPosition || null,
          is_captain: addLineupCaptain,
        }),
      });
      await parseJsonOrThrow(res);
      setAddLineupMsg('Added!');
      setAddLineupPlayer('');
      setAddLineupNumber('');
      setAddLineupAmplua('');
      setAddLineupFieldPosition('');
      setAddLineupCaptain(false);
      void fetchLineup();
    } catch (err) {
      setAddLineupMsg(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setLineupBusy(false);
    }
  };

  // Sync lineup
  const syncLineup = async () => {
    setLineupBusy(true);
    try {
      const res = await authFetch(`/ops/live/sync-lineup/${gameId}`, { method: 'POST' });
      await parseJsonOrThrow(res);
      void fetchLineup();
    } catch (err) {
      setLineupError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setLineupBusy(false);
    }
  };

  // Delete referee
  const deleteReferee = async (entryId: number) => {
    setRefereesBusy(true);
    try {
      const res = await authFetch(`/games/${gameId}/referees/${entryId}`, { method: 'DELETE' });
      await parseJsonOrThrow(res);
      void fetchReferees();
    } catch (err) {
      setRefereesError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setRefereesBusy(false);
    }
  };

  // Add referee
  const addReferee = async () => {
    if (!addRefReferee) return;
    setRefereesBusy(true);
    setAddRefMsg('');
    try {
      const res = await authFetch(`/games/${gameId}/referees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referee_id: Number(addRefReferee),
          role: addRefRole,
        }),
      });
      await parseJsonOrThrow(res);
      setAddRefMsg('Added!');
      setAddRefReferee('');
      void fetchReferees();
    } catch (err) {
      setAddRefMsg(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setRefereesBusy(false);
    }
  };

  // Delete event
  const deleteEvent = async (eventId: number) => {
    const evtToDelete = events.find(e => e.id === eventId);
    setEventsBusy(true);
    try {
      const res = await authFetch(`/games/${gameId}/events/${eventId}`, { method: 'DELETE' });
      await parseJsonOrThrow(res);
      if (evtToDelete && SCORE_EVENT_TYPES.includes(evtToDelete.event_type)) {
        const remaining = events.filter(e => e.id !== eventId);
        let home = 0, away = 0;
        for (const ev of remaining) {
          if (ev.event_type === 'goal' || ev.event_type === 'penalty') {
            if (ev.team_id === game?.home_team_id) home++;
            else if (ev.team_id === game?.away_team_id) away++;
          } else if (ev.event_type === 'own_goal') {
            if (ev.team_id === game?.home_team_id) away++;
            else if (ev.team_id === game?.away_team_id) home++;
          }
        }
        await patchScore(home, away);
      }
      void fetchEvents();
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setEventsBusy(false);
    }
  };

  // Add event
  const addEvent = async () => {
    if (!addEvtMinute) {
      setAddEvtMsg('Укажите минуту');
      return;
    }
    setEventsBusy(true);
    setAddEvtMsg('');
    try {
      const teamId = addEvtTeam === 'home' ? game?.home_team_id : addEvtTeam === 'away' ? game?.away_team_id : null;
      const findInLineup = (id: string) => lineup.find(e => String(e.player_id) === id);
      const p1 = findInLineup(addEvtPlayerId);
      const p2 = findInLineup(addEvtPlayer2Id);
      const pa = findInLineup(addEvtAssistId);
      const res = await authFetch(`/games/${gameId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          half: Number(addEvtHalf),
          minute: Number(addEvtMinute),
          event_type: addEvtType,
          team_id: teamId ?? null,
          player_id: p1?.player_id ?? null,
          player_name: p1?.player_name ?? null,
          player_number: p1?.shirt_number ?? null,
          player2_id: p2?.player_id ?? null,
          player2_name: p2?.player_name ?? null,
          assist_player_id: pa?.player_id ?? null,
          assist_player_name: pa?.player_name ?? null,
        }),
      });
      await parseJsonOrThrow(res);
      setAddEvtMsg('Added!');
      setAddEvtPlayerId('');
      setAddEvtPlayer2Id('');
      setAddEvtAssistId('');
      setAddEvtMinute('');
      setAddEvtTeam('');
      if (SCORE_EVENT_TYPES.includes(addEvtType)) {
        const evtTeamId = addEvtTeam === 'home' ? game?.home_team_id ?? null : game?.away_team_id ?? null;
        let newHome = game?.home_score ?? 0;
        let newAway = game?.away_score ?? 0;
        if (addEvtType === 'goal' || addEvtType === 'penalty') {
          if (evtTeamId === game?.home_team_id) newHome++;
          else if (evtTeamId === game?.away_team_id) newAway++;
        } else if (addEvtType === 'own_goal') {
          if (evtTeamId === game?.home_team_id) newAway++;
          else if (evtTeamId === game?.away_team_id) newHome++;
        }
        await patchScore(newHome, newAway);
      }
      void fetchEvents();
    } catch (err) {
      setAddEvtMsg(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setEventsBusy(false);
    }
  };

  // Patch score
  const patchScore = async (home: number, away: number) => {
    await authFetch(`/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home_score: home, away_score: away }),
    });
    void fetchGame();
  };

  // Sync events
  const syncEvents = async () => {
    setEventsBusy(true);
    try {
      const res = await authFetch(`/ops/live/sync-events/${gameId}`, { method: 'POST' });
      await parseJsonOrThrow(res);
      void fetchEvents();
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setEventsBusy(false);
    }
  };

  if (!hasRole('superadmin', 'editor', 'operator')) {
    return <div className="card text-sm text-admin-muted">Access denied.</div>;
  }

  if (gameLoading) return <div className="card text-sm text-admin-muted">Loading game...</div>;
  if (gameError) return <div className="card text-sm text-red-100">{gameError}</div>;
  if (!game) return null;

  const homeTeamLineup = lineup.filter((e) => e.team_id === game.home_team_id);
  const awayTeamLineup = lineup.filter((e) => e.team_id === game.away_team_id);

  // Event form helpers
  const evtCfg = EVENT_CONFIG[addEvtType] ?? EVENT_CONFIG['goal'];
  const evtTeamId = addEvtTeam === 'home' ? game.home_team_id : addEvtTeam === 'away' ? game.away_team_id : null;
  const evtOppositeTeamId = addEvtTeam === 'home' ? game.away_team_id : addEvtTeam === 'away' ? game.home_team_id : null;

  const lineupOptions = (teamId: number | null, onlyType?: 'starter' | 'substitute') => {
    const entries = lineup.filter(e =>
      e.team_id === teamId && (!onlyType || e.lineup_type === onlyType)
    );
    return [
      { value: '', label: '—' },
      ...entries.map(e => ({
        value: String(e.player_id),
        label: `${e.shirt_number ? '#' + e.shirt_number + ' ' : ''}${e.player_name ?? '#' + e.player_id}${e.amplua ? ' (' + e.amplua + ')' : ''}`,
      })),
    ];
  };

  const handlePlayerSelect = (id: string) => {
    setAddEvtPlayerId(id);
    if (id) {
      const entry = lineup.find(e => String(e.player_id) === id);
      if (entry) {
        const side = entry.team_id === game.home_team_id ? 'home' : 'away';
        setAddEvtTeam(side);
      }
    }
    setAddEvtAssistId('');
  };

  const playerOptions = evtCfg.playerFrom === 'opposite'
    ? lineupOptions(evtOppositeTeamId)
    : evtCfg.playerFrom === 'starters'
    ? lineupOptions(evtTeamId, 'starter')
    : lineupOptions(evtTeamId);

  const player2Options = lineupOptions(evtTeamId, 'substitute');
  const assistOptions = lineupOptions(evtTeamId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card">
        <div className="flex items-center gap-3">
          <Link href="/games" className="text-sm text-admin-muted hover:text-white">← Games</Link>
          <h1 className="font-[var(--font-heading)] text-2xl">
            {game.home_team_name ?? `Team #${game.home_team_id}`}
            {' vs '}
            {game.away_team_name ?? `Team #${game.away_team_id}`}
          </h1>
          <span className="rounded bg-admin-line px-2 py-0.5 text-xs text-admin-muted">#{game.id}</span>
        </div>
        <p className="mt-1 text-sm text-admin-muted">
          {game.date} {game.time ? game.time.slice(0, 5) : ''} · Season {game.season_id} · Tour {game.tour ?? '-'}
        </p>
      </section>

      {/* Section 1: Game Info Edit */}
      <section className="card">
        <h2 className="font-[var(--font-heading)] text-lg mb-3">Game Info</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Date</label>
            <input type="date" className="field" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Time</label>
            <input type="time" className="field" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Status</label>
            <select className="field" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-admin-muted cursor-pointer">
              <input type="checkbox" checked={editFeatured} onChange={(e) => setEditFeatured(e.target.checked)} />
              Featured
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer text-orange-300">
              <input type="checkbox" checked={editSyncDisabled} onChange={(e) => setEditSyncDisabled(e.target.checked)} />
              Disable SOTA sync
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Home Score</label>
            <input type="number" className="field w-20" value={editHomeScore} onChange={(e) => setEditHomeScore(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Away Score</label>
            <input type="number" className="field w-20" value={editAwayScore} onChange={(e) => setEditAwayScore(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Home Penalty</label>
            <input type="number" className="field w-20" value={editHomePenalty} onChange={(e) => setEditHomePenalty(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Away Penalty</label>
            <input type="number" className="field w-20" value={editAwayPenalty} onChange={(e) => setEditAwayPenalty(e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase text-admin-muted tracking-wider">Media / URLs</h3>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Video URL (YouTube replay)</label>
            <input type="url" className="field w-full" value={editVideoUrl}
              onChange={(e) => setEditVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Live Stream URL (YouTube Live)</label>
            <input type="url" className="field w-full" value={editYoutubeLiveUrl}
              onChange={(e) => setEditYoutubeLiveUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn" onClick={() => void saveGame()} disabled={saveLoading}>
            {saveLoading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            className="rounded border border-yellow-600/50 bg-yellow-900/30 px-3 py-1.5 text-sm text-yellow-300 hover:bg-yellow-800/40"
            onClick={() => void resetStatus()}
            disabled={saveLoading}
          >
            Reset to Not Started
          </button>
          {saveMsg && <span className="text-sm text-admin-muted">{saveMsg}</span>}
        </div>
      </section>

      {/* Section 2: Lineup */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[var(--font-heading)] text-lg">Lineup</h2>
          <div className="flex items-center gap-2">
            {editSyncDisabled && (
              <span className="rounded bg-orange-900/40 px-2 py-0.5 text-xs text-orange-300">Sync disabled</span>
            )}
            <button
              className="btn btn-muted text-xs"
              onClick={() => void syncLineup()}
              disabled={lineupBusy || editSyncDisabled}
            >
              {lineupBusy ? '...' : 'Sync Lineup'}
            </button>
          </div>
        </div>

        {lineupError && <div className="mb-2 text-sm text-red-300">{lineupError}</div>}

        {lineupLoading ? (
          <div className="text-sm text-admin-muted">Loading lineup...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-line text-left text-xs uppercase text-admin-muted">
                  <th className="px-2 py-2">Team</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Player</th>
                  <th className="px-2 py-2">Amplua</th>
                  <th className="px-2 py-2">Pos</th>
                  <th className="px-2 py-2">Cap</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {homeTeamLineup.map((e) => (
                  <tr key={e.id} className="border-b border-admin-line/50 hover:bg-[#192640]/50">
                    <td className="px-2 py-1.5 text-xs text-blue-300">{game.home_team_name ?? 'Home'}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{e.lineup_type}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{e.shirt_number ?? '-'}</td>
                    <td className="px-2 py-1.5">{e.player_name ?? `#${e.player_id}`}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{e.amplua ?? '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{e.field_position ?? '-'}</td>
                    <td className="px-2 py-1.5 text-xs">{e.is_captain ? '★' : ''}</td>
                    <td className="px-2 py-1.5">
                      <button
                        className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-300 hover:bg-red-800/60"
                        disabled={lineupBusy}
                        onClick={() => void deleteLineup(e.id)}
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
                {awayTeamLineup.map((e) => (
                  <tr key={e.id} className="border-b border-admin-line/50 hover:bg-[#192640]/50">
                    <td className="px-2 py-1.5 text-xs text-orange-300">{game.away_team_name ?? 'Away'}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{e.lineup_type}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{e.shirt_number ?? '-'}</td>
                    <td className="px-2 py-1.5">{e.player_name ?? `#${e.player_id}`}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{e.amplua ?? '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{e.field_position ?? '-'}</td>
                    <td className="px-2 py-1.5 text-xs">{e.is_captain ? '★' : ''}</td>
                    <td className="px-2 py-1.5">
                      <button
                        className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-300 hover:bg-red-800/60"
                        disabled={lineupBusy}
                        onClick={() => void deleteLineup(e.id)}
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
                {lineup.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-sm text-admin-muted">No lineup entries.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add lineup form */}
        <div className="mt-4 border-t border-admin-line pt-4">
          <h3 className="mb-3 text-sm font-medium text-admin-muted">Add Player to Lineup</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Team</label>
              <select
                className="field w-36"
                value={addLineupTeam}
                onChange={(e) => setAddLineupTeam(e.target.value as 'home' | 'away')}
              >
                <option value="home">{game.home_team_name ?? 'Home'}</option>
                <option value="away">{game.away_team_name ?? 'Away'}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Player</label>
              <Combobox
                className="w-56"
                options={[
                  { value: '', label: 'Select player' },
                  ...addLineupPlayers.map((p) => ({ value: String(p.id), label: p.number != null ? `#${p.number} ${p.name}` : p.name })),
                ]}
                value={addLineupPlayer}
                onChange={(val) => {
                  setAddLineupPlayer(val);
                  const found = addLineupPlayers.find(p => String(p.id) === val);
                  if (found?.number != null) setAddLineupNumber(String(found.number));
                  else setAddLineupNumber('');
                }}
                placeholder="Select player"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Type</label>
              <select className="field w-32" value={addLineupType} onChange={(e) => setAddLineupType(e.target.value)}>
                {LINEUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted"># Shirt</label>
              <input type="number" className="field w-20" value={addLineupNumber} onChange={(e) => setAddLineupNumber(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Amplua</label>
              <Combobox
                className="w-48"
                options={AMPLUA_OPTIONS}
                value={addLineupAmplua}
                onChange={setAddLineupAmplua}
                placeholder="—"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Position</label>
              <Combobox
                className="w-36"
                options={FIELD_POSITION_OPTIONS}
                value={addLineupFieldPosition}
                onChange={setAddLineupFieldPosition}
                placeholder="—"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-admin-muted cursor-pointer">
                <input type="checkbox" checked={addLineupCaptain} onChange={(e) => setAddLineupCaptain(e.target.checked)} />
                Captain
              </label>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn" onClick={() => void addLineup()} disabled={lineupBusy || !addLineupPlayer}>
                {lineupBusy ? '...' : 'Add'}
              </button>
              {addLineupMsg && <span className="text-xs text-admin-muted">{addLineupMsg}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Referees */}
      <section className="card">
        <h2 className="font-[var(--font-heading)] text-lg mb-3">Referees</h2>

        {refereesError && <div className="mb-2 text-sm text-red-300">{refereesError}</div>}

        {refereesLoading ? (
          <div className="text-sm text-admin-muted">Loading referees...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-line text-left text-xs uppercase text-admin-muted">
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Referee</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {referees.map((r) => (
                  <tr key={r.id} className="border-b border-admin-line/50 hover:bg-[#192640]/50">
                    <td className="px-2 py-1.5 text-xs">
                      <span className="rounded bg-admin-line px-1.5 py-0.5">
                        {REFEREE_ROLES.find(rr => rr.value === r.role)?.label ?? r.role}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{r.referee_name ?? `#${r.referee_id}`}</td>
                    <td className="px-2 py-1.5">
                      <button
                        className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-300 hover:bg-red-800/60"
                        disabled={refereesBusy}
                        onClick={() => void deleteReferee(r.id)}
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
                {referees.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-sm text-admin-muted">No referees assigned.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add referee form */}
        <div className="mt-4 border-t border-admin-line pt-4">
          <h3 className="mb-3 text-sm font-medium text-admin-muted">Assign Referee</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Referee</label>
              <Combobox
                className="w-56"
                options={[
                  { value: '', label: 'Select referee' },
                  ...refereeOptions.map((r) => ({ value: String(r.id), label: r.name })),
                ]}
                value={addRefReferee}
                onChange={setAddRefReferee}
                placeholder="Select referee"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Role</label>
              <select className="field w-40" value={addRefRole} onChange={(e) => setAddRefRole(e.target.value)}>
                {REFEREE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn" onClick={() => void addReferee()} disabled={refereesBusy || !addRefReferee}>
                {refereesBusy ? '...' : 'Assign'}
              </button>
              {addRefMsg && <span className="text-xs text-admin-muted">{addRefMsg}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Events */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[var(--font-heading)] text-lg">Events</h2>
          <div className="flex items-center gap-2">
            {editSyncDisabled && (
              <span className="rounded bg-orange-900/40 px-2 py-0.5 text-xs text-orange-300">Sync disabled</span>
            )}
            <button
              className="btn btn-muted text-xs"
              onClick={() => void syncEvents()}
              disabled={eventsBusy || editSyncDisabled}
            >
              {eventsBusy ? '...' : 'Sync Events'}
            </button>
          </div>
        </div>

        {eventsError && <div className="mb-2 text-sm text-red-300">{eventsError}</div>}

        {eventsLoading ? (
          <div className="text-sm text-admin-muted">Loading events...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-line text-left text-xs uppercase text-admin-muted">
                  <th className="px-2 py-2">Half</th>
                  <th className="px-2 py-2">Min</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Team</th>
                  <th className="px-2 py-2">Player</th>
                  <th className="px-2 py-2">Player2</th>
                  <th className="px-2 py-2">Assist</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-admin-line/50 hover:bg-[#192640]/50">
                    <td className="px-2 py-1.5 font-mono text-xs">{ev.half}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{ev.minute}&apos;</td>
                    <td className="px-2 py-1.5 text-xs">
                      <span className="rounded bg-admin-line px-1.5 py-0.5">{ev.event_type}</span>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">
                      {ev.team_id === game.home_team_id ? (game.home_team_name ?? 'Home') :
                       ev.team_id === game.away_team_id ? (game.away_team_name ?? 'Away') : '-'}
                    </td>
                    <td className="px-2 py-1.5">{ev.player_name ?? '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{ev.player2_name ?? '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-admin-muted">{ev.assist_player_name ?? '-'}</td>
                    <td className="px-2 py-1.5">
                      <button
                        className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-300 hover:bg-red-800/60"
                        disabled={eventsBusy}
                        onClick={() => void deleteEvent(ev.id)}
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-sm text-admin-muted">No events.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add event form */}
        <div className="mt-4 border-t border-admin-line pt-4">
          <h3 className="mb-3 text-sm font-medium text-admin-muted">Add Event</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Half</label>
              <select className="field w-20" value={addEvtHalf} onChange={(e) => setAddEvtHalf(e.target.value)}>
                <option value="1">1st</option>
                <option value="2">2nd</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Minute</label>
              <input type="number" className="field w-20" value={addEvtMinute} onChange={(e) => setAddEvtMinute(e.target.value)} placeholder="45" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Type</label>
              <select className="field w-36" value={addEvtType} onChange={(e) => setAddEvtType(e.target.value)}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">Team</label>
              <select className="field w-36" value={addEvtTeam} onChange={(e) => {
                setAddEvtTeam(e.target.value as 'home' | 'away' | '');
                setAddEvtPlayerId('');
                setAddEvtPlayer2Id('');
                setAddEvtAssistId('');
              }}>
                <option value="">—</option>
                <option value="home">{game.home_team_name ?? 'Home'}</option>
                <option value="away">{game.away_team_name ?? 'Away'}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-admin-muted">{evtCfg.playerLabel}</label>
              <Combobox
                className="w-56"
                options={playerOptions}
                value={addEvtPlayerId}
                onChange={handlePlayerSelect}
                placeholder="—"
              />
            </div>
            {evtCfg.showPlayer2 && (
              <div>
                <label className="mb-1 block text-xs text-admin-muted">{evtCfg.player2Label ?? 'Player2'}</label>
                <Combobox
                  className="w-56"
                  options={player2Options}
                  value={addEvtPlayer2Id}
                  onChange={setAddEvtPlayer2Id}
                  placeholder="—"
                />
              </div>
            )}
            {evtCfg.showAssist && (
              <div>
                <label className="mb-1 block text-xs text-admin-muted">Assist</label>
                <Combobox
                  className="w-56"
                  options={assistOptions}
                  value={addEvtAssistId}
                  onChange={setAddEvtAssistId}
                  placeholder="—"
                />
              </div>
            )}
            <div className="flex items-end gap-2">
              <button className="btn" onClick={() => void addEvent()} disabled={eventsBusy}>
                {eventsBusy ? '...' : 'Add'}
              </button>
              {addEvtMsg && <span className="text-xs text-admin-muted">{addEvtMsg}</span>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
