'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';
import type {
  AdminContractListItem,
  AdminContractMeta,
  AdminContractsListResponse,
} from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<number, string> = {
  1: 'Игрок',
  2: 'Тренер',
  3: 'Сотрудник',
  4: 'Администрация',
};

const AMPLUA_LABELS: Record<number, string> = {
  1: 'Вратарь',
  2: 'Защитник',
  3: 'Полузащитник',
  4: 'Нападающий',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ContractFormState = {
  player_id: string;
  team_id: string;
  season_id: string;
  role: string;
  amplua: string;
  number: string;
  position_ru: string;
  position_kz: string;
  position_en: string;
  photo_url: string;
  is_active: string;
  is_hidden: string;
};

const emptyForm = (): ContractFormState => ({
  player_id: '',
  team_id: '',
  season_id: '',
  role: '1',
  amplua: '',
  number: '',
  position_ru: '',
  position_kz: '',
  position_en: '',
  photo_url: '',
  is_active: '1',
  is_hidden: '0',
});

function mapContractToForm(item: AdminContractListItem): ContractFormState {
  return {
    player_id: item.player_id.toString(),
    team_id: item.team_id.toString(),
    season_id: item.season_id.toString(),
    role: (item.role ?? 1).toString(),
    amplua: item.amplua?.toString() ?? '',
    number: item.number?.toString() ?? '',
    position_ru: item.position_ru ?? '',
    position_kz: item.position_kz ?? '',
    position_en: item.position_en ?? '',
    photo_url: item.photo_url ?? '',
    is_active: item.is_active ? '1' : '0',
    is_hidden: item.is_hidden ? '1' : '0',
  };
}

function nullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

function nullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPayload(form: ContractFormState) {
  return {
    player_id: parseInt(form.player_id, 10),
    team_id: parseInt(form.team_id, 10),
    season_id: parseInt(form.season_id, 10),
    role: parseInt(form.role, 10) || 1,
    amplua: form.role === '1' ? nullableInt(form.amplua) : null,
    number: form.role === '1' ? nullableInt(form.number) : null,
    position_ru: ['2', '3', '4'].includes(form.role) ? nullableString(form.position_ru) : null,
    position_kz: ['2', '3', '4'].includes(form.role) ? nullableString(form.position_kz) : null,
    position_en: ['2', '3', '4'].includes(form.role) ? nullableString(form.position_en) : null,
    photo_url: nullableString(form.photo_url),
    is_active: form.is_active === '1',
    is_hidden: form.is_hidden === '1',
  };
}

function playerDisplayName(meta: AdminContractMeta, playerId: number): string {
  const p = meta.players.find((x) => x.id === playerId);
  if (!p) return `Player #${playerId}`;
  const name = [p.last_name, p.first_name].filter(Boolean).join(' ').trim();
  return name || `Player #${playerId}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { authFetch, hasRole } = useAuth();
  const canManage = hasRole('superadmin', 'editor');

  const [meta, setMeta] = useState<AdminContractMeta>({ players: [], teams: [], seasons: [] });
  const [contracts, setContracts] = useState<AdminContractListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');       // ''|'true'|'false'
  const [filterHidden, setFilterHidden] = useState('');       // ''|'true'|'false'
  const [filterRole, setFilterRole] = useState('');           // ''|'1'|'2'|'3'|'4'
  const [filterPlayer, setFilterPlayer] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterSota, setFilterSota] = useState('');           // ''|'true'|'false'
  const [pageLimit, setPageLimit] = useState(25);
  const [pageOffset, setPageOffset] = useState(0);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContractFormState>(emptyForm());

  // Player search filter in form select
  const [playerSearch, setPlayerSearch] = useState('');

  const loadMeta = useCallback(async () => {
    const res = await authFetch('/contracts/meta');
    const data = (await parseJsonOrThrow(res)) as AdminContractMeta;
    setMeta(data);
  }, [authFetch]);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', pageLimit.toString());
      params.set('offset', pageOffset.toString());
      if (filterStatus) params.set('is_active', filterStatus);
      if (filterHidden) params.set('is_hidden', filterHidden);
      if (filterRole) params.set('role', filterRole);
      if (filterPlayer) params.set('player_id', filterPlayer);
      if (filterSeason) params.set('season_id', filterSeason);
      if (filterTeam) params.set('team_id', filterTeam);
      if (filterSota) params.set('has_sota_id', filterSota);

      const res = await authFetch(`/contracts?${params.toString()}`);
      const data = (await parseJsonOrThrow(res)) as AdminContractsListResponse;
      setContracts(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить контракты');
    } finally {
      setLoading(false);
    }
  }, [authFetch, filterStatus, filterHidden, filterRole, filterPlayer, filterSeason, filterTeam, filterSota, pageLimit, pageOffset]);

  useEffect(() => {
    if (!canManage) return;
    void loadMeta();
  }, [canManage, loadMeta]);

  useEffect(() => {
    if (!canManage) return;
    void loadContracts();
  }, [canManage, loadContracts]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setPlayerSearch('');
    setError(null);
    setSuccess(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setPlayerSearch('');
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const startEdit = (item: AdminContractListItem) => {
    setEditingId(item.id);
    setForm(mapContractToForm(item));
    setPlayerSearch('');
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = toPayload(form);
      const isEdit = editingId !== null;
      const path = isEdit ? `/contracts/${editingId}` : '/contracts';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await authFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await parseJsonOrThrow(res);
      setSuccess(isEdit ? 'Контракт обновлён.' : 'Контракт создан.');
      await loadContracts();
      if (!isEdit) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить контракт');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: AdminContractListItem) => {
    const name = playerDisplayName(meta, item.player_id);
    if (!window.confirm(`Удалить контракт ${name} → ${item.team_name ?? item.team_id} (${item.season_name ?? item.season_id})?`)) return;
    setDeletingId(item.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await authFetch(`/contracts/${item.id}`, { method: 'DELETE' });
      await parseJsonOrThrow(res);
      setSuccess('Контракт удалён.');
      if (editingId === item.id) resetForm();
      await loadContracts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить контракт');
    } finally {
      setDeletingId(null);
    }
  };

  const applyFilters = () => {
    setPageOffset(0);
    void loadContracts();
  };

  const resetFilters = () => {
    setFilterStatus('');
    setFilterHidden('');
    setFilterRole('');
    setFilterPlayer('');
    setFilterSeason('');
    setFilterTeam('');
    setFilterSota('');
    setPageOffset(0);
  };

  // Filtered players for select
  const filteredPlayers = playerSearch.trim()
    ? meta.players.filter((p) => {
        const q = playerSearch.toLowerCase();
        return (
          p.last_name?.toLowerCase().includes(q) ||
          p.first_name?.toLowerCase().includes(q)
        );
      })
    : meta.players;

  if (!canManage) {
    return <div className="card text-sm text-admin-muted">Раздел доступен только superadmin/editor.</div>;
  }

  const totalPages = Math.ceil(total / pageLimit);
  const currentPage = Math.floor(pageOffset / pageLimit) + 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-heading)] text-2xl">Контракты / Заявки на сезон</h1>
          <p className="mt-1 text-sm text-admin-muted">
            Управление заявками персонала (игроки, тренеры, сотрудники, администрация) на сезон.
          </p>
        </div>
        <button className="btn btn-primary shrink-0" type="button" onClick={startAdd}>
          + Добавить контракт
        </button>
      </section>

      {/* Form */}
      {showForm && (
        <section className="card">
          <h2 className="mb-4 font-[var(--font-heading)] text-xl">
            {editingId !== null ? `Редактирование контракта #${editingId}` : 'Новый контракт'}
          </h2>
          <form className="space-y-4" onSubmit={onSubmit}>
            {/* Status row */}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Статус
                <select
                  className="field"
                  value={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value }))}
                >
                  <option value="1">Активен</option>
                  <option value="0">Неактивен</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Скрыт
                <select
                  className="field"
                  value={form.is_hidden}
                  onChange={(e) => setForm((p) => ({ ...p, is_hidden: e.target.value }))}
                >
                  <option value="0">Нет (виден)</option>
                  <option value="1">Да (скрыт)</option>
                </select>
              </label>
            </div>

            {/* Player with search */}
            <div className="space-y-1">
              <label className="text-sm text-admin-muted">Персона</label>
              <input
                className="field"
                placeholder="Поиск по фамилии/имени..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />
              <select
                className="field"
                value={form.player_id}
                onChange={(e) => setForm((p) => ({ ...p, player_id: e.target.value }))}
                required
                size={Math.min(filteredPlayers.length + 1, 8)}
              >
                <option value="">— Выберите персону —</option>
                {filteredPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.last_name, p.first_name].filter(Boolean).join(' ') || `#${p.id}`}
                    {p.sota_id ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Роль
                <select
                  className="field"
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, role: e.target.value, amplua: '', number: '', position_ru: '', position_kz: '', position_en: '' }))
                  }
                >
                  <option value="1">Игрок</option>
                  <option value="2">Тренер</option>
                  <option value="3">Сотрудник</option>
                  <option value="4">Администрация</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Сезон
                <select
                  className="field"
                  value={form.season_id}
                  onChange={(e) => setForm((p) => ({ ...p, season_id: e.target.value }))}
                  required
                >
                  <option value="">— Сезон —</option>
                  {meta.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.championship_name ? `${s.championship_name} — ` : ''}{s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Команда
                <select
                  className="field"
                  value={form.team_id}
                  onChange={(e) => setForm((p) => ({ ...p, team_id: e.target.value }))}
                  required
                >
                  <option value="">— Команда —</option>
                  {meta.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Photo URL */}
            <input
              className="field"
              value={form.photo_url}
              onChange={(e) => setForm((p) => ({ ...p, photo_url: e.target.value }))}
              placeholder="Фото URL"
            />

            {/* Role=1 (Игрок) specific fields */}
            {form.role === '1' && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-admin-muted">
                  Амплуа
                  <select
                    className="field"
                    value={form.amplua}
                    onChange={(e) => setForm((p) => ({ ...p, amplua: e.target.value }))}
                  >
                    <option value="">— Амплуа —</option>
                    <option value="1">Вратарь</option>
                    <option value="2">Защитник</option>
                    <option value="3">Полузащитник</option>
                    <option value="4">Нападающий</option>
                  </select>
                </label>
                <input
                  className="field self-end"
                  type="number"
                  min={0}
                  value={form.number}
                  onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
                  placeholder="Номер"
                />
              </div>
            )}

            {/* Role=2/3/4 (Personnel) specific fields */}
            {['2', '3', '4'].includes(form.role) && (
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="field"
                  value={form.position_ru}
                  onChange={(e) => setForm((p) => ({ ...p, position_ru: e.target.value }))}
                  placeholder="Должность (RU)"
                />
                <input
                  className="field"
                  value={form.position_kz}
                  onChange={(e) => setForm((p) => ({ ...p, position_kz: e.target.value }))}
                  placeholder="Должность (KZ)"
                />
                <input
                  className="field"
                  value={form.position_en}
                  onChange={(e) => setForm((p) => ({ ...p, position_en: e.target.value }))}
                  placeholder="Должность (EN)"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : editingId !== null ? 'Сохранить изменения' : 'Создать контракт'}
              </button>
              <button className="btn btn-muted" type="button" onClick={resetForm} disabled={saving}>
                Отмена
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Messages */}
      {error && <section className="card border-admin-danger text-sm text-red-100">{error}</section>}
      {success && <section className="card text-sm text-emerald-200">{success}</section>}

      {/* Filters */}
      <section className="card">
        <h2 className="mb-3 font-[var(--font-heading)] text-lg">Фильтры</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <select className="field" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="true">Активен</option>
            <option value="false">Неактивен</option>
          </select>

          <select className="field" value={filterHidden} onChange={(e) => setFilterHidden(e.target.value)}>
            <option value="">Все (скрыт)</option>
            <option value="true">Скрыт</option>
            <option value="false">Виден</option>
          </select>

          <select className="field" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">Все роли</option>
            <option value="1">Игрок</option>
            <option value="2">Тренер</option>
            <option value="3">Сотрудник</option>
            <option value="4">Администрация</option>
          </select>

          <select className="field" value={filterSota} onChange={(e) => setFilterSota(e.target.value)}>
            <option value="">SOTA: Все</option>
            <option value="true">Привязан к SOTA</option>
            <option value="false">Не привязан</option>
          </select>

          <select className="field" value={filterPlayer} onChange={(e) => setFilterPlayer(e.target.value)}>
            <option value="">Все персоны</option>
            {meta.players.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.last_name, p.first_name].filter(Boolean).join(' ') || `#${p.id}`}
              </option>
            ))}
          </select>

          <select className="field" value={filterSeason} onChange={(e) => setFilterSeason(e.target.value)}>
            <option value="">Все сезоны</option>
            {meta.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.championship_name ? `${s.championship_name} — ` : ''}{s.name}
              </option>
            ))}
          </select>

          <select className="field" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
            <option value="">Все команды</option>
            {meta.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select className="field" value={pageLimit.toString()} onChange={(e) => { setPageLimit(parseInt(e.target.value, 10)); setPageOffset(0); }}>
            <option value="10">10 на стр.</option>
            <option value="25">25 на стр.</option>
            <option value="50">50 на стр.</option>
            <option value="100">100 на стр.</option>
          </select>
        </div>

        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary" type="button" onClick={applyFilters} disabled={loading}>
            Применить
          </button>
          <button className="btn btn-muted" type="button" onClick={() => { resetFilters(); }} disabled={loading}>
            Сброс
          </button>
        </div>
      </section>

      {/* Table */}
      <section className="card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between text-sm text-admin-muted">
          <span>Найдено записей: {total}</span>
          <span>Страница {currentPage} из {Math.max(totalPages, 1)}</span>
        </div>

        {loading && <p className="text-sm text-admin-muted">Загружаем контракты...</p>}
        {!loading && contracts.length === 0 && (
          <p className="text-sm text-admin-muted">Контракты не найдены.</p>
        )}

        {!loading && contracts.length > 0 && (
          <table className="w-full min-w-[1000px] border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-admin-muted">
                <th className="px-2 py-1">#</th>
                <th className="px-2 py-1">Персона</th>
                <th className="px-2 py-1">Сезон</th>
                <th className="px-2 py-1">Команда</th>
                <th className="px-2 py-1">Роль</th>
                <th className="px-2 py-1">Амплуа/Должность</th>
                <th className="px-2 py-1">№</th>
                <th className="px-2 py-1">SOTA</th>
                <th className="px-2 py-1">Скрыт</th>
                <th className="px-2 py-1">Статус</th>
                <th className="px-2 py-1">Действия</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((item) => {
                const ampluaOrPosition =
                  item.role === 1
                    ? AMPLUA_LABELS[item.amplua ?? 0] ?? '—'
                    : item.position_ru ?? '—';

                return (
                  <tr key={item.id} className="bg-[#0E172A]">
                    <td className="px-2 py-2 text-admin-muted">{item.id}</td>
                    <td className="px-2 py-2">
                      <div>{[item.player_last_name, item.player_first_name].filter(Boolean).join(' ') || `#${item.player_id}`}</div>
                      <div className="text-xs text-admin-muted">id={item.player_id}</div>
                    </td>
                    <td className="px-2 py-2 text-xs">{item.season_name ?? item.season_id}</td>
                    <td className="px-2 py-2 text-xs">{item.team_name ?? item.team_id}</td>
                    <td className="px-2 py-2">
                      <span className="rounded bg-[#192640] px-1.5 py-0.5 text-xs">
                        {ROLE_LABELS[item.role ?? 1] ?? `role=${item.role}`}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-admin-muted">{ampluaOrPosition}</td>
                    <td className="px-2 py-2 text-xs">{item.number ?? '—'}</td>
                    <td className="px-2 py-2 text-xs">
                      {item.player_sota_id ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-admin-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {item.is_hidden ? (
                        <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-300">Скрыт</span>
                      ) : (
                        <span className="text-xs text-admin-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {item.is_active ? (
                        <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-xs text-emerald-300">Активен</span>
                      ) : (
                        <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-xs text-red-300">Неактивен</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          className="btn btn-muted"
                          type="button"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => void onDelete(item)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? '...' : 'Del'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > pageLimit && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <button
              className="btn btn-muted"
              type="button"
              disabled={pageOffset === 0 || loading}
              onClick={() => setPageOffset(Math.max(0, pageOffset - pageLimit))}
            >
              ← Пред
            </button>
            <span className="text-admin-muted">
              {pageOffset + 1}–{Math.min(pageOffset + pageLimit, total)} из {total}
            </span>
            <button
              className="btn btn-muted"
              type="button"
              disabled={pageOffset + pageLimit >= total || loading}
              onClick={() => setPageOffset(pageOffset + pageLimit)}
            >
              След →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
