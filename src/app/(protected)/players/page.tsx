'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';
import type {
  AdminPlayer,
  AdminPlayersListResponse,
  AdminPlayersMetaResponse,
} from '@/lib/types';

type TeamBindingDraft = {
  key: string;
  team_id: string;
  season_id: string;
  number: string;
};

type PlayerFormState = {
  sota_id: string;
  first_name: string;
  first_name_kz: string;
  first_name_en: string;
  last_name: string;
  last_name_kz: string;
  last_name_en: string;
  birthday: string;
  player_type: string;
  country_id: string;
  photo_url: string;
  age: string;
  top_role: string;
  top_role_kz: string;
  top_role_en: string;
  team_bindings: TeamBindingDraft[];
};

type LinkedToSotaFilter = 'all' | 'linked' | 'unlinked';

const emptyFormState = (): PlayerFormState => ({
  sota_id: '',
  first_name: '',
  first_name_kz: '',
  first_name_en: '',
  last_name: '',
  last_name_kz: '',
  last_name_en: '',
  birthday: '',
  player_type: '',
  country_id: '',
  photo_url: '',
  age: '',
  top_role: '',
  top_role_kz: '',
  top_role_en: '',
  team_bindings: [],
});

const makeDraftBinding = (): TeamBindingDraft => ({
  key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  team_id: '',
  season_id: '',
  number: '',
});

function nullableString(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function nullableInt(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function playerDisplayName(player: AdminPlayer): string {
  const last = player.last_name ?? player.last_name_kz ?? player.last_name_en ?? '';
  const first = player.first_name ?? player.first_name_kz ?? player.first_name_en ?? '';
  return [last, first].filter(Boolean).join(' ').trim() || `Player #${player.id}`;
}

function mapPlayerToForm(player: AdminPlayer): PlayerFormState {
  return {
    sota_id: player.sota_id ?? '',
    first_name: player.first_name ?? '',
    first_name_kz: player.first_name_kz ?? '',
    first_name_en: player.first_name_en ?? '',
    last_name: player.last_name ?? '',
    last_name_kz: player.last_name_kz ?? '',
    last_name_en: player.last_name_en ?? '',
    birthday: player.birthday ?? '',
    player_type: player.player_type ?? '',
    country_id: player.country_id?.toString() ?? '',
    photo_url: player.photo_url ?? '',
    age: player.age?.toString() ?? '',
    top_role: player.top_role ?? '',
    top_role_kz: player.top_role_kz ?? '',
    top_role_en: player.top_role_en ?? '',
    team_bindings: player.team_bindings.map((binding) => ({
      key: `${binding.team_id}-${binding.season_id}-${binding.number ?? 'none'}-${Math.random().toString(16).slice(2)}`,
      team_id: binding.team_id.toString(),
      season_id: binding.season_id.toString(),
      number: binding.number?.toString() ?? '',
    })),
  };
}

function toPayload(form: PlayerFormState) {
  return {
    sota_id: nullableString(form.sota_id),
    first_name: nullableString(form.first_name),
    first_name_kz: nullableString(form.first_name_kz),
    first_name_en: nullableString(form.first_name_en),
    last_name: nullableString(form.last_name),
    last_name_kz: nullableString(form.last_name_kz),
    last_name_en: nullableString(form.last_name_en),
    birthday: nullableString(form.birthday),
    player_type: nullableString(form.player_type),
    country_id: nullableInt(form.country_id),
    photo_url: nullableString(form.photo_url),
    age: nullableInt(form.age),
    top_role: nullableString(form.top_role),
    top_role_kz: nullableString(form.top_role_kz),
    top_role_en: nullableString(form.top_role_en),
    team_bindings: form.team_bindings
      .map((binding) => ({
        team_id: nullableInt(binding.team_id),
        season_id: nullableInt(binding.season_id),
        number: nullableInt(binding.number),
      }))
      .filter((binding) => binding.team_id !== null && binding.season_id !== null)
      .map((binding) => ({
        team_id: binding.team_id as number,
        season_id: binding.season_id as number,
        number: binding.number,
      })),
  };
}

export default function PlayersPage() {
  const { authFetch, hasRole } = useAuth();
  const [meta, setMeta] = useState<AdminPlayersMetaResponse>({
    countries: [],
    teams: [],
    seasons: [],
  });
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [linkedFilter, setLinkedFilter] = useState<LinkedToSotaFilter>('all');

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [form, setForm] = useState<PlayerFormState>(emptyFormState);

  const canManagePlayers = hasRole('superadmin', 'editor');
  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId]
  );

  const loadMeta = useCallback(async () => {
    const response = await authFetch('/players/meta');
    const data = (await parseJsonOrThrow(response)) as AdminPlayersMetaResponse;
    setMeta(data);
  }, [authFetch]);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('offset', '0');

      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (seasonFilter) {
        params.set('season_id', seasonFilter);
      }
      if (teamFilter) {
        params.set('team_id', teamFilter);
      }
      if (linkedFilter === 'linked') {
        params.set('linked_to_sota', 'true');
      }
      if (linkedFilter === 'unlinked') {
        params.set('linked_to_sota', 'false');
      }

      const response = await authFetch(`/players?${params.toString()}`);
      const data = (await parseJsonOrThrow(response)) as AdminPlayersListResponse;
      setPlayers(data.items);
      setTotal(data.total);
      if (selectedPlayerId !== null && !data.items.some((item) => item.id === selectedPlayerId)) {
        setSelectedPlayerId(null);
        setForm(emptyFormState());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить список игроков');
    } finally {
      setLoading(false);
    }
  }, [authFetch, linkedFilter, search, seasonFilter, selectedPlayerId, teamFilter]);

  useEffect(() => {
    if (!canManagePlayers) {
      return;
    }
    void loadMeta();
  }, [canManagePlayers, loadMeta]);

  useEffect(() => {
    if (!canManagePlayers) {
      return;
    }
    void loadPlayers();
  }, [canManagePlayers, loadPlayers]);

  const resetForm = () => {
    setSelectedPlayerId(null);
    setForm(emptyFormState());
    setSuccess(null);
    setError(null);
  };

  const startEdit = (player: AdminPlayer) => {
    setSelectedPlayerId(player.id);
    setForm(mapPlayerToForm(player));
    setSuccess(null);
    setError(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = toPayload(form);
      const isEdit = selectedPlayerId !== null;
      const path = isEdit ? `/players/${selectedPlayerId}` : '/players';
      const method = isEdit ? 'PATCH' : 'POST';
      const response = await authFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const savedPlayer = (await parseJsonOrThrow(response)) as AdminPlayer;
      setSuccess(isEdit ? 'Игрок обновлён.' : 'Игрок создан.');
      setSelectedPlayerId(savedPlayer.id);
      setForm(mapPlayerToForm(savedPlayer));
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить игрока');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (player: AdminPlayer) => {
    const confirmed = window.confirm(`Удалить игрока ${playerDisplayName(player)}?`);
    if (!confirmed) {
      return;
    }

    setDeletingPlayerId(player.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await authFetch(`/players/${player.id}`, { method: 'DELETE' });
      await parseJsonOrThrow(response);
      setSuccess('Игрок удалён.');
      if (selectedPlayerId === player.id) {
        resetForm();
      }
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить игрока');
    } finally {
      setDeletingPlayerId(null);
    }
  };

  const updateBinding = (key: string, field: keyof Omit<TeamBindingDraft, 'key'>, value: string) => {
    setForm((prev) => ({
      ...prev,
      team_bindings: prev.team_bindings.map((binding) =>
        binding.key === key ? { ...binding, [field]: value } : binding
      ),
    }));
  };

  if (!canManagePlayers) {
    return <div className="card text-sm text-admin-muted">Раздел доступен только superadmin/editor.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Players</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Ручное управление игроками, привязками к командам/сезонам и `sota_id`.
        </p>
      </section>

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">Фильтры</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени"
          />

          <select className="field" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            <option value="">Все сезоны</option>
            {meta.seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>

          <select className="field" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">Все команды</option>
            {meta.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          <select
            className="field"
            value={linkedFilter}
            onChange={(e) => setLinkedFilter(e.target.value as LinkedToSotaFilter)}
          >
            <option value="all">Все игроки</option>
            <option value="linked">Только linked_to_sota=true</option>
            <option value="unlinked">Только linked_to_sota=false</option>
          </select>
        </div>

        <div className="mt-3 flex gap-2">
          <button className="btn btn-muted" type="button" onClick={() => void loadPlayers()} disabled={loading}>
            {loading ? 'Загрузка...' : 'Обновить список'}
          </button>
          <button className="btn btn-primary" type="button" onClick={resetForm} disabled={saving}>
            Новый игрок
          </button>
        </div>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}
      {success ? <section className="card text-sm text-emerald-200">{success}</section> : null}

      <section className="card overflow-x-auto">
        <div className="mb-3 text-sm text-admin-muted">Найдено игроков: {total}</div>
        {loading ? <p className="text-sm text-admin-muted">Загружаем игроков...</p> : null}
        {!loading && players.length === 0 ? <p className="text-sm text-admin-muted">Игроки не найдены.</p> : null}

        {!loading && players.length > 0 ? (
          <table className="w-full min-w-[1100px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-admin-muted">
                <th>ID</th>
                <th>Игрок</th>
                <th>SOTA</th>
                <th>Страна</th>
                <th>Привязки</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const countryName = meta.countries.find((country) => country.id === player.country_id)?.name ?? '—';
                return (
                  <tr key={player.id} className="bg-[#0E172A]">
                    <td className="px-2 py-2">{player.id}</td>
                    <td className="px-2 py-2">
                      <div>{playerDisplayName(player)}</div>
                      <div className="text-xs text-admin-muted">{player.player_type ?? '—'}</div>
                    </td>
                    <td className="px-2 py-2 text-xs text-admin-muted">{player.sota_id ?? '—'}</td>
                    <td className="px-2 py-2">{countryName}</td>
                    <td className="px-2 py-2 text-xs">
                      {player.team_bindings.length === 0 ? (
                        <span className="text-admin-muted">—</span>
                      ) : (
                        player.team_bindings.map((binding) => (
                          <div key={`${player.id}-${binding.team_id}-${binding.season_id}`}>
                            {binding.season_name ?? binding.season_id} / {binding.team_name ?? binding.team_id}
                            {binding.number !== null ? ` #${binding.number}` : ''}
                          </div>
                        ))
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button className="btn btn-muted" type="button" onClick={() => startEdit(player)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => void onDelete(player)}
                          disabled={deletingPlayerId === player.id}
                        >
                          {deletingPlayerId === player.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">
          {selectedPlayer ? `Редактирование: ${playerDisplayName(selectedPlayer)}` : 'Создание игрока'}
        </h2>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="field"
              value={form.last_name}
              onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
              placeholder="Фамилия (RU)"
            />
            <input
              className="field"
              value={form.last_name_kz}
              onChange={(e) => setForm((prev) => ({ ...prev, last_name_kz: e.target.value }))}
              placeholder="Фамилия (KZ)"
            />
            <input
              className="field"
              value={form.last_name_en}
              onChange={(e) => setForm((prev) => ({ ...prev, last_name_en: e.target.value }))}
              placeholder="Фамилия (EN)"
            />

            <input
              className="field"
              value={form.first_name}
              onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
              placeholder="Имя (RU)"
            />
            <input
              className="field"
              value={form.first_name_kz}
              onChange={(e) => setForm((prev) => ({ ...prev, first_name_kz: e.target.value }))}
              placeholder="Имя (KZ)"
            />
            <input
              className="field"
              value={form.first_name_en}
              onChange={(e) => setForm((prev) => ({ ...prev, first_name_en: e.target.value }))}
              placeholder="Имя (EN)"
            />

            <input
              className="field"
              value={form.birthday}
              onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
              placeholder="Дата рождения"
              type="date"
            />
            <select
              className="field"
              value={form.country_id}
              onChange={(e) => setForm((prev) => ({ ...prev, country_id: e.target.value }))}
            >
              <option value="">Страна</option>
              {meta.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
            <input
              className="field"
              value={form.age}
              onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
              placeholder="Возраст"
              type="number"
              min={0}
            />

            <input
              className="field"
              value={form.player_type}
              onChange={(e) => setForm((prev) => ({ ...prev, player_type: e.target.value }))}
              placeholder="Тип/позиция"
            />
            <input
              className="field"
              value={form.top_role}
              onChange={(e) => setForm((prev) => ({ ...prev, top_role: e.target.value }))}
              placeholder="Role (RU)"
            />
            <input
              className="field"
              value={form.top_role_kz}
              onChange={(e) => setForm((prev) => ({ ...prev, top_role_kz: e.target.value }))}
              placeholder="Role (KZ)"
            />

            <input
              className="field"
              value={form.top_role_en}
              onChange={(e) => setForm((prev) => ({ ...prev, top_role_en: e.target.value }))}
              placeholder="Role (EN)"
            />
            <input
              className="field md:col-span-2"
              value={form.photo_url}
              onChange={(e) => setForm((prev) => ({ ...prev, photo_url: e.target.value }))}
              placeholder="Фото URL"
            />
            <input
              className="field"
              value={form.sota_id}
              onChange={(e) => setForm((prev) => ({ ...prev, sota_id: e.target.value }))}
              placeholder="SOTA UUID"
            />
          </div>

          <div className="rounded-xl border border-admin-line p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">Team bindings</h3>
              <button
                className="btn btn-muted"
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, team_bindings: [...prev.team_bindings, makeDraftBinding()] }))
                }
              >
                Add binding
              </button>
            </div>

            {form.team_bindings.length === 0 ? (
              <p className="text-sm text-admin-muted">Нет привязок. Можно оставить пусто.</p>
            ) : (
              <div className="space-y-2">
                {form.team_bindings.map((binding) => (
                  <div key={binding.key} className="grid gap-2 rounded-lg bg-[#0E172A] p-2 md:grid-cols-[1.2fr_1.2fr_1fr_auto]">
                    <select
                      className="field"
                      value={binding.team_id}
                      onChange={(e) => updateBinding(binding.key, 'team_id', e.target.value)}
                    >
                      <option value="">Team</option>
                      {meta.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="field"
                      value={binding.season_id}
                      onChange={(e) => updateBinding(binding.key, 'season_id', e.target.value)}
                    >
                      <option value="">Season</option>
                      {meta.seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name}
                        </option>
                      ))}
                    </select>

                    <input
                      className="field"
                      value={binding.number}
                      onChange={(e) => updateBinding(binding.key, 'number', e.target.value)}
                      placeholder="Number"
                      type="number"
                      min={0}
                    />

                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          team_bindings: prev.team_bindings.filter((item) => item.key !== binding.key),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Сохраняем...' : selectedPlayer ? 'Сохранить изменения' : 'Создать игрока'}
            </button>
            {selectedPlayer ? (
              <button className="btn btn-muted" type="button" onClick={resetForm} disabled={saving}>
                Отменить редактирование
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
