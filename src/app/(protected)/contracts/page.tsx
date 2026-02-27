'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import Combobox from '@/components/Combobox';
import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';
import type {
  AdminContractBulkCopyResponse,
  AdminContractListItem,
  AdminContractMeta,
  AdminContractsListResponse,
  AdminPlayer,
  AdminPlayersListResponse,
  AdminPlayersMetaResponse,
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

type CopyOverride = {
  number?: string;
  amplua?: string;
  position_ru?: string;
  position_kz?: string;
  position_en?: string;
  photo_url?: string;
};

type InlinePlayerFormState = {
  last_name: string;
  first_name: string;
  last_name_kz: string;
  first_name_kz: string;
  birthday: string;
  country_id: string;
  player_type: string;
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

  // Photo upload
  const [photoUploading, setPhotoUploading] = useState(false);

  // Season filtering in form
  const [formSeasonTeamIds, setFormSeasonTeamIds] = useState<Set<number> | null>(null);

  // Bulk copy state
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copySource, setCopySource] = useState('');
  const [copyTarget, setCopyTarget] = useState('');
  const [copyTeam, setCopyTeam] = useState('');
  const [copyPreview, setCopyPreview] = useState<AdminContractListItem[]>([]);
  const [copyExcluded, setCopyExcluded] = useState<Set<number>>(new Set());
  const [copyOverrides, setCopyOverrides] = useState<Record<number, CopyOverride>>({});
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyResult, setCopyResult] = useState<AdminContractBulkCopyResponse | null>(null);
  const [copyPhotoUploading, setCopyPhotoUploading] = useState<number | null>(null);
  const [copySourceTeamIds, setCopySourceTeamIds] = useState<Set<number> | null>(null);

  // Add-player states
  const [addMode, setAddMode] = useState<'search' | 'create' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminPlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayer | null>(null);
  const [newPlayerForm, setNewPlayerForm] = useState<InlinePlayerFormState>({
    last_name: '', first_name: '', last_name_kz: '', first_name_kz: '',
    birthday: '', country_id: '', player_type: 'football',
  });
  const [playersMeta, setPlayersMeta] = useState<AdminPlayersMetaResponse | null>(null);
  const [addRole, setAddRole] = useState('1');
  const [addAmplua, setAddAmplua] = useState('');
  const [addNumber, setAddNumber] = useState('');
  const [addPositionRu, setAddPositionRu] = useState('');
  const [addPositionKz, setAddPositionKz] = useState('');
  const [addPositionEn, setAddPositionEn] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setFormSeasonTeamIds(null);
    setError(null);
    setSuccess(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormSeasonTeamIds(null);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const startEdit = (item: AdminContractListItem) => {
    setEditingId(item.id);
    setForm(mapContractToForm(item));
    setFormSeasonTeamIds(null);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleSeasonChange = async (seasonId: string) => {
    setForm((p) => ({ ...p, season_id: seasonId, team_id: '' }));
    if (!seasonId) {
      setFormSeasonTeamIds(null);
      return;
    }
    try {
      const res = await authFetch(`/season-participants?season_id=${seasonId}&limit=200`);
      const data = await parseJsonOrThrow(res) as { items?: Array<{ team_id: number }> };
      const ids = (data.items ?? []).map((x) => x.team_id);
      setFormSeasonTeamIds(new Set(ids));
    } catch {
      setFormSeasonTeamIds(null);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/files/upload?category=player_photos', {
        method: 'POST',
        body: formData,
      });
      const data = await parseJsonOrThrow(res) as { url: string };
      setForm((p) => ({ ...p, photo_url: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setPhotoUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.player_id || !form.team_id || !form.season_id) {
      setError('Заполните обязательные поля: игрок, команда и сезон.');
      return;
    }
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

  const loadCopyPreview = async () => {
    if (!copySource || !copyTeam) return;
    setCopyLoading(true);
    setCopyResult(null);
    try {
      const res = await authFetch(`/contracts?season_id=${copySource}&team_id=${copyTeam}&limit=200`);
      const data = (await parseJsonOrThrow(res)) as AdminContractsListResponse;
      setCopyPreview(data.items);
      setCopyExcluded(new Set());
      setCopyOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить состав');
    } finally {
      setCopyLoading(false);
    }
  };

  const handleCopySourceChange = async (seasonId: string) => {
    setCopySource(seasonId);
    setCopyTeam('');
    setCopyPreview([]);
    setCopyResult(null);
    if (!seasonId) {
      setCopySourceTeamIds(null);
      return;
    }
    try {
      const res = await authFetch(`/season-participants?season_id=${seasonId}&limit=200`);
      const data = (await parseJsonOrThrow(res)) as { items?: Array<{ team_id: number }> };
      setCopySourceTeamIds(new Set((data.items ?? []).map((x) => x.team_id)));
    } catch {
      setCopySourceTeamIds(null);
    }
  };

  const executeBulkCopy = async () => {
    if (!copySource || !copyTarget || !copyTeam) return;
    const includedPlayers = copyPreview.filter((c) => !copyExcluded.has(c.id) && c.role === 1);
    const missingFields = includedPlayers.filter((c) => {
      const ov = copyOverrides[c.id] ?? {};
      const effectiveNumber = ov.number !== undefined ? ov.number : (c.number?.toString() ?? '');
      const effectiveAmplua = ov.amplua !== undefined ? ov.amplua : (c.amplua?.toString() ?? '');
      return !effectiveNumber || !effectiveAmplua;
    });
    if (missingFields.length > 0) {
      const names = missingFields.map((c) => [c.player_last_name, c.player_first_name].filter(Boolean).join(' ') || `#${c.player_id}`).join(', ');
      setError(`У следующих игроков не заполнены номер или амплуа: ${names}`);
      return;
    }
    const count = copyPreview.filter((c) => !copyExcluded.has(c.id)).length;
    if (!window.confirm(`Будет создано ${count} контрактов. Продолжить?`)) return;
    setCopyLoading(true);
    setError(null);
    try {
      const overridesList = copyPreview
        .filter((c) => !copyExcluded.has(c.id) && copyOverrides[c.id])
        .map((c) => {
          const ov = copyOverrides[c.id];
          return {
            player_id: c.player_id,
            role: c.role ?? 1,
            ...(ov.number !== undefined ? { number: parseInt(ov.number) || null } : {}),
            ...(ov.amplua !== undefined ? { amplua: parseInt(ov.amplua) || null } : {}),
            ...(ov.position_ru !== undefined ? { position_ru: ov.position_ru || null } : {}),
            ...(ov.position_kz !== undefined ? { position_kz: ov.position_kz || null } : {}),
            ...(ov.position_en !== undefined ? { position_en: ov.position_en || null } : {}),
            ...(ov.photo_url !== undefined ? { photo_url: ov.photo_url || null } : {}),
          };
        });

      const excludedPlayerIds = copyPreview
        .filter((c) => copyExcluded.has(c.id))
        .map((c) => c.player_id);

      const res = await authFetch('/contracts/bulk-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_season_id: parseInt(copySource),
          target_season_id: parseInt(copyTarget),
          team_id: parseInt(copyTeam),
          excluded_player_ids: excludedPlayerIds,
          overrides: overridesList,
        }),
      });
      const data = (await parseJsonOrThrow(res)) as AdminContractBulkCopyResponse;
      setCopyResult(data);
      setCopyPreview([]);
      setCopyExcluded(new Set());
      setCopyOverrides({});
      setFilterSeason(copyTarget);
      setFilterTeam(copyTeam);
      await loadContracts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить перенос');
    } finally {
      setCopyLoading(false);
    }
  };

  const handlePhotoUploadForCopy = async (contractId: number, file: File) => {
    setCopyPhotoUploading(contractId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/files/upload?category=player_photos', {
        method: 'POST',
        body: formData,
      });
      const data = (await parseJsonOrThrow(res)) as { url: string };
      setCopyOverrides((prev) => ({
        ...prev,
        [contractId]: { ...prev[contractId], photo_url: data.url },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setCopyPhotoUploading(null);
    }
  };

  const toggleCopyExcluded = (contractId: number) => {
    setCopyExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  };

  const updateCopyOverride = (contractId: number, field: keyof CopyOverride, value: string) => {
    setCopyOverrides((prev) => ({
      ...prev,
      [contractId]: { ...prev[contractId], [field]: value },
    }));
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

  // ── Add-player: debounce search ──────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ search: searchQuery.trim(), limit: '20' });
        const res = await authFetch(`/players?${params}`);
        const data = (await parseJsonOrThrow(res)) as AdminPlayersListResponse;
        setSearchResults(data.items);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const loadPlayersMeta = async () => {
    if (playersMeta) return;
    try {
      const res = await authFetch('/players/meta');
      const data = (await parseJsonOrThrow(res)) as AdminPlayersMetaResponse;
      setPlayersMeta(data);
    } catch {
      /* ignore */
    }
  };

  const resetAddForm = () => {
    setAddMode(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPlayer(null);
    setNewPlayerForm({
      last_name: '', first_name: '', last_name_kz: '', first_name_kz: '',
      birthday: '', country_id: '', player_type: 'football',
    });
    setAddRole('1');
    setAddAmplua('');
    setAddNumber('');
    setAddPositionRu('');
    setAddPositionKz('');
    setAddPositionEn('');
  };

  const buildAddContractPayload = (playerId: number) => ({
    player_id: playerId,
    team_id: parseInt(copyTeam, 10),
    season_id: parseInt(copyTarget, 10),
    role: parseInt(addRole, 10) || 1,
    amplua: addRole === '1' ? nullableInt(addAmplua) : null,
    number: addRole === '1' ? nullableInt(addNumber) : null,
    position_ru: ['2', '3', '4'].includes(addRole) ? nullableString(addPositionRu) : null,
    position_kz: ['2', '3', '4'].includes(addRole) ? nullableString(addPositionKz) : null,
    position_en: ['2', '3', '4'].includes(addRole) ? nullableString(addPositionEn) : null,
    photo_url: null,
    is_active: true,
    is_hidden: false,
  });

  const handleAddExistingPlayer = async () => {
    if (!selectedPlayer || !copyTarget || !copyTeam) return;
    if (addRole === '1' && (!addAmplua || !addNumber)) {
      setError('Для игрока обязательны амплуа и номер');
      return;
    }
    setAddSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = buildAddContractPayload(selectedPlayer.id);
      const res = await authFetch('/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await parseJsonOrThrow(res);
      const name = [selectedPlayer.last_name, selectedPlayer.first_name].filter(Boolean).join(' ');
      setSuccess(`Контракт для ${name} создан.`);
      resetAddForm();
      await loadContracts();
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать контракт');
    } finally {
      setAddSaving(false);
    }
  };

  const handleCreateAndAddPlayer = async () => {
    if (!copyTarget || !copyTeam) return;
    if (!newPlayerForm.last_name.trim()) {
      setError('Фамилия обязательна');
      return;
    }
    if (addRole === '1' && (!addAmplua || !addNumber)) {
      setError('Для игрока обязательны амплуа и номер');
      return;
    }
    setAddSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Create player
      const playerPayload: Record<string, unknown> = {
        last_name: newPlayerForm.last_name.trim(),
        first_name: nullableString(newPlayerForm.first_name),
        last_name_kz: nullableString(newPlayerForm.last_name_kz),
        first_name_kz: nullableString(newPlayerForm.first_name_kz),
        birthday: nullableString(newPlayerForm.birthday),
        country_id: newPlayerForm.country_id ? parseInt(newPlayerForm.country_id, 10) : null,
        player_type: newPlayerForm.player_type || 'football',
      };
      const playerRes = await authFetch('/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerPayload),
      });
      const player = (await parseJsonOrThrow(playerRes)) as AdminPlayer;

      // 2. Create contract
      const contractPayload = buildAddContractPayload(player.id);
      const contractRes = await authFetch('/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractPayload),
      });
      await parseJsonOrThrow(contractRes);

      const name = [player.last_name, player.first_name].filter(Boolean).join(' ');
      setSuccess(`Игрок ${name} создан и добавлен в заявку.`);
      resetAddForm();
      await loadContracts();
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать игрока/контракт');
    } finally {
      setAddSaving(false);
    }
  };

  // Teams for form: filtered by season
  const teamsForForm = formSeasonTeamIds
    ? meta.teams.filter((t) => formSeasonTeamIds.has(t.id))
    : meta.teams;

  if (!canManage) {
    return <div className="card text-sm text-admin-muted">Раздел доступен только superadmin/editor.</div>;
  }

  const totalPages = Math.ceil(total / pageLimit);
  const currentPage = Math.floor(pageOffset / pageLimit) + 1;

  // Пункт 4: при создании — скрыть фильтры и таблицу
  const isCreating = showForm && editingId === null;

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
            {/* Пункт 2: Checkboxes instead of selects */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active === '1'}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked ? '1' : '0' }))}
                />
                Активен
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_hidden === '1'}
                  onChange={(e) => setForm((p) => ({ ...p, is_hidden: e.target.checked ? '1' : '0' }))}
                />
                Скрыт
              </label>
            </div>

            {/* Player with combobox */}
            <div className="space-y-1">
              <label className="text-sm text-admin-muted">Персона</label>
              <Combobox
                options={[
                  { value: '', label: '— Выберите персону —' },
                  ...meta.players.map((p) => ({
                    value: p.id.toString(),
                    label: [p.last_name, p.first_name].filter(Boolean).join(' ') || `#${p.id}`,
                  })),
                ]}
                value={form.player_id}
                onChange={(v) => setForm((p) => ({ ...p, player_id: v }))}
                placeholder="— Выберите персону —"
                searchPlaceholder="Поиск по фамилии/имени..."
              />
            </div>

            {/* Role + Season (season first per пункт 3c) */}
            <div className="grid gap-3 md:grid-cols-2">
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
                  onChange={(e) => void handleSeasonChange(e.target.value)}
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
            </div>

            {/* Team with combobox, filtered by season */}
            <div className="space-y-1">
              <label className="text-sm text-admin-muted">
                Команда
                {formSeasonTeamIds !== null && (
                  <span className="ml-2 text-xs text-admin-muted">(участники выбранного сезона: {formSeasonTeamIds.size})</span>
                )}
              </label>
              <Combobox
                options={[
                  { value: '', label: '— Команда —' },
                  ...teamsForForm.map((t) => ({ value: t.id.toString(), label: t.name })),
                ]}
                value={form.team_id}
                onChange={(v) => setForm((p) => ({ ...p, team_id: v }))}
                placeholder="— Команда —"
                searchPlaceholder="Поиск команды..."
              />
            </div>

            {/* Пункт 3a: Photo upload */}
            <div>
              <label className="mb-1 block text-sm text-admin-muted">Фото</label>
              <div className="flex gap-2 items-center">
                {form.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photo_url} alt="Фото" className="h-12 w-12 rounded object-cover shrink-0" />
                )}
                <input
                  className="field flex-1"
                  value={form.photo_url}
                  onChange={(e) => setForm((p) => ({ ...p, photo_url: e.target.value }))}
                  placeholder="Фото URL"
                />
                <label className="btn btn-muted cursor-pointer shrink-0">
                  {photoUploading ? 'Загрузка...' : '↑ Загрузить'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => void handlePhotoUpload(e)}
                    disabled={photoUploading}
                  />
                </label>
              </div>
            </div>

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

      {/* Bulk Copy Panel */}
      <section className="card">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowCopyPanel((v) => !v)}
        >
          <h2 className="font-[var(--font-heading)] text-xl">
            {showCopyPanel ? '▾' : '▸'} Перенос заявки на новый сезон
          </h2>
          <span className="text-xs text-admin-muted">{showCopyPanel ? 'Свернуть' : 'Развернуть'}</span>
        </button>

        {showCopyPanel && (
          <div className="mt-4 space-y-4">
            {/* Controls row */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-admin-muted">Исходный сезон</label>
                <select className="field" value={copySource} onChange={(e) => void handleCopySourceChange(e.target.value)}>
                  <option value="">— Сезон —</option>
                  {meta.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.championship_name ? `${s.championship_name} — ` : ''}{s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-admin-muted">Целевой сезон</label>
                <select className="field" value={copyTarget} onChange={(e) => setCopyTarget(e.target.value)}>
                  <option value="">— Сезон —</option>
                  {meta.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.championship_name ? `${s.championship_name} — ` : ''}{s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-admin-muted">
                  Команда
                  {copySourceTeamIds !== null && (
                    <span className="ml-2 text-xs text-admin-muted">(участников: {copySourceTeamIds.size})</span>
                  )}
                </label>
                <Combobox
                  options={[
                    { value: '', label: '— Команда —' },
                    ...(copySourceTeamIds ? meta.teams.filter((t) => copySourceTeamIds.has(t.id)) : meta.teams).map((t) => ({ value: t.id.toString(), label: t.name })),
                  ]}
                  value={copyTeam}
                  onChange={(v) => { setCopyTeam(v); setCopyPreview([]); setCopyResult(null); }}
                  placeholder="— Команда —"
                  searchPlaceholder="Поиск команды..."
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={!copySource || !copyTeam || copyLoading}
                  onClick={() => void loadCopyPreview()}
                >
                  {copyLoading && copyPreview.length === 0 ? 'Загрузка...' : 'Загрузить состав'}
                </button>
              </div>
            </div>

            {/* ── Add player to roster ─────────────────────────────────── */}
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-[var(--font-heading)] text-lg">Добавить игрока в заявку</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setAddMode(addMode === 'search' ? null : 'search'); setSelectedPlayer(null); }}
                  >
                    Поиск существующего
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setAddMode(addMode === 'create' ? null : 'create'); void loadPlayersMeta(); }}
                  >
                    Создать нового
                  </button>
                </div>
              </div>

              {(!copyTarget || !copyTeam) && addMode && (
                <p className="text-xs text-yellow-400 mb-3">Выберите целевой сезон и команду выше.</p>
              )}

              {/* Search mode */}
              {addMode === 'search' && (
                <div className="space-y-3">
                  <input
                    className="field w-full"
                    placeholder="Поиск по фамилии/имени..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedPlayer(null); }}
                  />
                  {searchLoading && <p className="text-xs text-admin-muted">Поиск...</p>}
                  {!searchLoading && searchResults.length > 0 && !selectedPlayer && (
                    <div className="max-h-48 overflow-y-auto rounded border border-white/10 bg-[#0E172A]">
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/5"
                          onClick={() => setSelectedPlayer(p)}
                        >
                          <span className="font-medium">
                            {[p.last_name, p.first_name].filter(Boolean).join(' ') || `#${p.id}`}
                          </span>
                          {p.birthday && <span className="text-xs text-admin-muted">{p.birthday}</span>}
                          {p.player_type && (
                            <span className="rounded bg-[#192640] px-1.5 py-0.5 text-xs">{p.player_type}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                    <p className="text-xs text-admin-muted">Ничего не найдено.</p>
                  )}

                  {selectedPlayer && (
                    <div className="space-y-3 rounded border border-white/10 bg-[#0E172A] p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {[selectedPlayer.last_name, selectedPlayer.first_name].filter(Boolean).join(' ')}
                          <span className="ml-2 text-xs text-admin-muted">id={selectedPlayer.id}</span>
                        </span>
                        <button
                          type="button"
                          className="text-xs text-admin-muted hover:text-white"
                          onClick={() => setSelectedPlayer(null)}
                        >
                          Сменить
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <select className="field" value={addRole} onChange={(e) => { setAddRole(e.target.value); setAddAmplua(''); setAddNumber(''); setAddPositionRu(''); setAddPositionKz(''); setAddPositionEn(''); }}>
                          <option value="1">Игрок</option>
                          <option value="2">Тренер</option>
                          <option value="3">Сотрудник</option>
                          <option value="4">Администрация</option>
                        </select>
                        {addRole === '1' && (
                          <>
                            <select className="field" value={addAmplua} onChange={(e) => setAddAmplua(e.target.value)}>
                              <option value="">— Амплуа * —</option>
                              <option value="1">Вратарь</option>
                              <option value="2">Защитник</option>
                              <option value="3">Полузащитник</option>
                              <option value="4">Нападающий</option>
                            </select>
                            <input className="field" type="number" min={0} placeholder="Номер *" value={addNumber} onChange={(e) => setAddNumber(e.target.value)} />
                          </>
                        )}
                        {['2', '3', '4'].includes(addRole) && (
                          <>
                            <input className="field" placeholder="Должность (RU)" value={addPositionRu} onChange={(e) => setAddPositionRu(e.target.value)} />
                            <input className="field" placeholder="Должность (KZ)" value={addPositionKz} onChange={(e) => setAddPositionKz(e.target.value)} />
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={addSaving || !copyTarget || !copyTeam || (addRole === '1' && (!addAmplua || !addNumber))}
                        onClick={() => void handleAddExistingPlayer()}
                      >
                        {addSaving ? 'Сохраняем...' : 'Добавить контракт'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Create mode */}
              {addMode === 'create' && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className="field"
                      placeholder="Фамилия *"
                      value={newPlayerForm.last_name}
                      onChange={(e) => setNewPlayerForm((p) => ({ ...p, last_name: e.target.value }))}
                    />
                    <input
                      className="field"
                      placeholder="Имя"
                      value={newPlayerForm.first_name}
                      onChange={(e) => setNewPlayerForm((p) => ({ ...p, first_name: e.target.value }))}
                    />
                    <input
                      className="field"
                      type="date"
                      placeholder="Дата рождения"
                      value={newPlayerForm.birthday}
                      onChange={(e) => setNewPlayerForm((p) => ({ ...p, birthday: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className="field"
                      placeholder="Фамилия (KZ)"
                      value={newPlayerForm.last_name_kz}
                      onChange={(e) => setNewPlayerForm((p) => ({ ...p, last_name_kz: e.target.value }))}
                    />
                    <input
                      className="field"
                      placeholder="Имя (KZ)"
                      value={newPlayerForm.first_name_kz}
                      onChange={(e) => setNewPlayerForm((p) => ({ ...p, first_name_kz: e.target.value }))}
                    />
                    <Combobox
                      options={[
                        { value: '', label: '— Страна —' },
                        ...(playersMeta?.countries ?? []).map((c) => ({ value: c.id.toString(), label: c.name })),
                      ]}
                      value={newPlayerForm.country_id}
                      onChange={(v) => setNewPlayerForm((p) => ({ ...p, country_id: v }))}
                      placeholder="— Страна —"
                      searchPlaceholder="Поиск страны..."
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <select className="field" value={addRole} onChange={(e) => { setAddRole(e.target.value); setAddAmplua(''); setAddNumber(''); setAddPositionRu(''); setAddPositionKz(''); setAddPositionEn(''); }}>
                      <option value="1">Игрок</option>
                      <option value="2">Тренер</option>
                      <option value="3">Сотрудник</option>
                      <option value="4">Администрация</option>
                    </select>
                    {addRole === '1' && (
                      <>
                        <select className="field" value={addAmplua} onChange={(e) => setAddAmplua(e.target.value)}>
                          <option value="">— Амплуа * —</option>
                          <option value="1">Вратарь</option>
                          <option value="2">Защитник</option>
                          <option value="3">Полузащитник</option>
                          <option value="4">Нападающий</option>
                        </select>
                        <input className="field" type="number" min={0} placeholder="Номер *" value={addNumber} onChange={(e) => setAddNumber(e.target.value)} />
                      </>
                    )}
                    {['2', '3', '4'].includes(addRole) && (
                      <>
                        <input className="field" placeholder="Должность (RU)" value={addPositionRu} onChange={(e) => setAddPositionRu(e.target.value)} />
                        <input className="field" placeholder="Должность (KZ)" value={addPositionKz} onChange={(e) => setAddPositionKz(e.target.value)} />
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={addSaving || !copyTarget || !copyTeam || !newPlayerForm.last_name.trim() || (addRole === '1' && (!addAmplua || !addNumber))}
                    onClick={() => void handleCreateAndAddPlayer()}
                  >
                    {addSaving ? 'Создаём...' : 'Создать и добавить'}
                  </button>
                </div>
              )}
            </div>

            {/* Preview list */}
            {copyPreview.length > 0 && (
              <>
                <p className="text-sm text-admin-muted">
                  {copyPreview.length} записей в составе · включено: {copyPreview.length - copyExcluded.size}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-separate border-spacing-y-1 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.12em] text-admin-muted">
                        <th className="px-2 py-1 w-8">
                          <input
                            type="checkbox"
                            checked={copyExcluded.size === 0}
                            onChange={() => {
                              if (copyExcluded.size === 0) {
                                setCopyExcluded(new Set(copyPreview.map((c) => c.id)));
                              } else {
                                setCopyExcluded(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="px-2 py-1">Персона</th>
                        <th className="px-2 py-1">Роль</th>
                        <th className="px-2 py-1 w-20">№</th>
                        <th className="px-2 py-1 w-36">Амплуа / Должность</th>
                        <th className="px-2 py-1">Фото URL</th>
                        <th className="px-2 py-1 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {copyPreview.map((c) => {
                        const excluded = copyExcluded.has(c.id);
                        const ov = copyOverrides[c.id] ?? {};
                        const isPlayer = c.role === 1;
                        const effectiveNumber = ov.number !== undefined ? ov.number : (c.number?.toString() ?? '');
                        const effectiveAmplua = ov.amplua !== undefined ? ov.amplua : (c.amplua?.toString() ?? '');
                        const numberMissing = isPlayer && !excluded && !effectiveNumber;
                        const ampluaMissing = isPlayer && !excluded && !effectiveAmplua;
                        return (
                          <tr key={c.id} className={excluded ? 'bg-[#0E172A] opacity-40' : 'bg-[#0E172A]'}>
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={!excluded}
                                onChange={() => toggleCopyExcluded(c.id)}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <div className="font-medium">
                                {[c.player_last_name, c.player_first_name].filter(Boolean).join(' ') || `#${c.player_id}`}
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              <span className="rounded bg-[#192640] px-1.5 py-0.5 text-xs">
                                {ROLE_LABELS[c.role ?? 1] ?? `role=${c.role}`}
                              </span>
                            </td>
                            <td className="px-2 py-1">
                              {isPlayer && (
                                <input
                                  type="number"
                                  className={`field w-16 text-center ${numberMissing ? 'border-red-500' : ''}`}
                                  min={0}
                                  placeholder={c.number?.toString() ?? '—'}
                                  value={ov.number ?? ''}
                                  onChange={(e) => updateCopyOverride(c.id, 'number', e.target.value)}
                                  disabled={excluded}
                                />
                              )}
                            </td>
                            <td className="px-2 py-1">
                              {isPlayer ? (
                                <select
                                  className={`field w-36 ${ampluaMissing ? 'border-red-500' : ''}`}
                                  value={ov.amplua ?? (c.amplua?.toString() ?? '')}
                                  onChange={(e) => updateCopyOverride(c.id, 'amplua', e.target.value)}
                                  disabled={excluded}
                                >
                                  <option value="">— Амплуа —</option>
                                  <option value="1">Вратарь</option>
                                  <option value="2">Защитник</option>
                                  <option value="3">Полузащитник</option>
                                  <option value="4">Нападающий</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  className="field w-36"
                                  placeholder={c.position_ru ?? 'Должность'}
                                  value={ov.position_ru ?? ''}
                                  onChange={(e) => updateCopyOverride(c.id, 'position_ru', e.target.value)}
                                  disabled={excluded}
                                />
                              )}
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                className="field w-full"
                                placeholder={c.photo_url ?? 'Фото URL'}
                                value={ov.photo_url !== undefined ? ov.photo_url : (c.photo_url ?? c.player_photo_url ?? '')}
                                onChange={(e) => updateCopyOverride(c.id, 'photo_url', e.target.value)}
                                disabled={excluded}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <label className={`btn btn-muted cursor-pointer text-xs px-2 py-1 ${excluded ? 'opacity-50 pointer-events-none' : ''}`}>
                                {copyPhotoUploading === c.id ? '...' : '↑'}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  disabled={excluded || copyPhotoUploading === c.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handlePhotoUploadForCopy(c.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const hasIncompletePlayer = copyPreview.some((c) => {
                    if (copyExcluded.has(c.id) || c.role !== 1) return false;
                    const ov = copyOverrides[c.id] ?? {};
                    const effectiveNumber = ov.number !== undefined ? ov.number : (c.number?.toString() ?? '');
                    const effectiveAmplua = ov.amplua !== undefined ? ov.amplua : (c.amplua?.toString() ?? '');
                    return !effectiveNumber || !effectiveAmplua;
                  });
                  return (
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!copyTarget || copyLoading || copyPreview.length === copyExcluded.size || hasIncompletePlayer}
                        onClick={() => void executeBulkCopy()}
                      >
                        {copyLoading ? 'Выполняем...' : `Перенести ${copyPreview.length - copyExcluded.size} контрактов →`}
                      </button>
                      {!copyTarget && (
                        <span className="text-xs text-admin-muted">Выберите целевой сезон</span>
                      )}
                      {hasIncompletePlayer && (
                        <span className="text-xs text-yellow-400">Заполните номер и амплуа у всех игроков</span>
                      )}
                    </div>
                  );
                })()}

                {copyResult && (
                  <div className="rounded border border-emerald-700 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
                    ✓ Создано: <strong>{copyResult.created}</strong> · Пропущено (уже существуют):{' '}
                    <strong>{copyResult.skipped}</strong> · Исключено: <strong>{copyResult.excluded}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Пункт 4: Filters — скрыть при создании или открытой панели переноса */}
      {!isCreating && !showCopyPanel && (
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

            <Combobox
              options={[
                { value: '', label: 'Все персоны' },
                ...meta.players.map((p) => ({
                  value: p.id.toString(),
                  label: [p.last_name, p.first_name].filter(Boolean).join(' ') || `#${p.id}`,
                })),
              ]}
              value={filterPlayer}
              onChange={setFilterPlayer}
              placeholder="Все персоны"
              searchPlaceholder="Поиск персоны..."
            />

            <select className="field" value={filterSeason} onChange={(e) => setFilterSeason(e.target.value)}>
              <option value="">Все сезоны</option>
              {meta.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.championship_name ? `${s.championship_name} — ` : ''}{s.name}
                </option>
              ))}
            </select>

            <Combobox
              options={[
                { value: '', label: 'Все команды' },
                ...meta.teams.map((t) => ({ value: t.id.toString(), label: t.name })),
              ]}
              value={filterTeam}
              onChange={setFilterTeam}
              placeholder="Все команды"
              searchPlaceholder="Поиск команды..."
            />

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
      )}

      {/* Пункт 4: Table — скрыть при создании или открытой панели переноса */}
      {!isCreating && !showCopyPanel && (
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
      )}
    </div>
  );
}
