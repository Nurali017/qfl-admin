'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import Combobox from '@/components/Combobox';
import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';
import type {
  AdminCoachAssignmentListItem,
  AdminCoachAssignmentsListResponse,
  AdminCoachBulkCopyResponse,
  AdminCoachMeta,
  CoachRoleValue,
} from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const COACH_ROLE_LABELS: Record<CoachRoleValue, string> = {
  head_coach: 'Главный тренер',
  assistant: 'Ассистент',
  goalkeeper_coach: 'Тренер вратарей',
  fitness_coach: 'Тренер по физподготовке',
  other: 'Другое',
};

const COACH_ROLES = Object.entries(COACH_ROLE_LABELS) as [CoachRoleValue, string][];

// ── Types ─────────────────────────────────────────────────────────────────────

type AssignmentFormState = {
  coach_id: string;
  team_id: string;
  season_id: string;
  role: CoachRoleValue;
  is_active: string;
  start_date: string;
  end_date: string;
};

type InlineCoachFormState = {
  first_name: string;
  last_name: string;
  first_name_kz: string;
  first_name_ru: string;
  first_name_en: string;
  last_name_kz: string;
  last_name_ru: string;
  last_name_en: string;
  photo_url: string;
  country_id: string;
};

const emptyForm = (): AssignmentFormState => ({
  coach_id: '',
  team_id: '',
  season_id: '',
  role: 'head_coach',
  is_active: '1',
  start_date: '',
  end_date: '',
});

const emptyInlineCoachForm = (): InlineCoachFormState => ({
  first_name: '',
  last_name: '',
  first_name_kz: '',
  first_name_ru: '',
  first_name_en: '',
  last_name_kz: '',
  last_name_ru: '',
  last_name_en: '',
  photo_url: '',
  country_id: '',
});

function mapAssignmentToForm(item: AdminCoachAssignmentListItem): AssignmentFormState {
  return {
    coach_id: item.coach_id.toString(),
    team_id: item.team_id.toString(),
    season_id: item.season_id?.toString() ?? '',
    role: item.role,
    is_active: item.is_active ? '1' : '0',
    start_date: item.start_date ?? '',
    end_date: item.end_date ?? '',
  };
}

function nullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coachDisplayName(meta: AdminCoachMeta, coachId: number): string {
  const c = meta.coaches.find((x) => x.id === coachId);
  if (!c) return `Coach #${coachId}`;
  const name = [c.last_name, c.first_name].filter(Boolean).join(' ').trim();
  return name || `Coach #${coachId}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoachesPage() {
  const { authFetch, hasRole } = useAuth();
  const canManage = hasRole('superadmin', 'editor');

  const [meta, setMeta] = useState<AdminCoachMeta>({ coaches: [], teams: [], seasons: [], countries: [] });
  const [assignments, setAssignments] = useState<AdminCoachAssignmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterTeam, setFilterTeam] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterCoach, setFilterCoach] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [pageLimit, setPageLimit] = useState(25);
  const [pageOffset, setPageOffset] = useState(0);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AssignmentFormState>(emptyForm());

  // Inline coach creation
  const [showInlineCoach, setShowInlineCoach] = useState(false);
  const [inlineCoachForm, setInlineCoachForm] = useState<InlineCoachFormState>(emptyInlineCoachForm());
  const [inlinePhotoUploading, setInlinePhotoUploading] = useState(false);

  // Bulk copy state
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copySource, setCopySource] = useState('');
  const [copyTarget, setCopyTarget] = useState('');
  const [copyTeam, setCopyTeam] = useState('');
  const [copyPreview, setCopyPreview] = useState<AdminCoachAssignmentListItem[]>([]);
  const [copyExcluded, setCopyExcluded] = useState<Set<number>>(new Set());
  const [copyOverrideRole, setCopyOverrideRole] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyResult, setCopyResult] = useState<AdminCoachBulkCopyResponse | null>(null);

  const loadMeta = useCallback(async () => {
    const res = await authFetch('/coaches/meta');
    const data = (await parseJsonOrThrow(res)) as AdminCoachMeta;
    setMeta(data);
  }, [authFetch]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', pageLimit.toString());
      params.set('offset', pageOffset.toString());
      if (filterTeam) params.set('team_id', filterTeam);
      if (filterSeason) params.set('season_id', filterSeason);
      if (filterCoach) params.set('coach_id', filterCoach);
      if (filterRole) params.set('role', filterRole);
      if (filterActive) params.set('is_active', filterActive);

      const res = await authFetch(`/coaches?${params.toString()}`);
      const data = (await parseJsonOrThrow(res)) as AdminCoachAssignmentsListResponse;
      setAssignments(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить назначения');
    } finally {
      setLoading(false);
    }
  }, [authFetch, filterTeam, filterSeason, filterCoach, filterRole, filterActive, pageLimit, pageOffset]);

  useEffect(() => {
    if (!canManage) return;
    void loadMeta();
  }, [canManage, loadMeta]);

  useEffect(() => {
    if (!canManage) return;
    void loadAssignments();
  }, [canManage, loadAssignments]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setShowInlineCoach(false);
    setInlineCoachForm(emptyInlineCoachForm());
    setError(null);
    setSuccess(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowInlineCoach(false);
    setInlineCoachForm(emptyInlineCoachForm());
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const startEdit = (item: AdminCoachAssignmentListItem) => {
    setEditingId(item.id);
    setForm(mapAssignmentToForm(item));
    setShowInlineCoach(false);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleInlinePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInlinePhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/files/upload?category=coach_photos', {
        method: 'POST',
        body: formData,
      });
      const data = (await parseJsonOrThrow(res)) as { url: string };
      setInlineCoachForm((p) => ({ ...p, photo_url: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setInlinePhotoUploading(false);
      e.target.value = '';
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const isEdit = editingId !== null;

    if (!isEdit && !form.coach_id && !showInlineCoach) {
      setError('Выберите тренера или создайте нового.');
      return;
    }
    if (!form.team_id) {
      setError('Выберите команду.');
      return;
    }
    if (showInlineCoach && !inlineCoachForm.last_name.trim()) {
      setError('Фамилия тренера обязательна.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (isEdit) {
        const payload: Record<string, unknown> = {
          team_id: parseInt(form.team_id, 10),
          season_id: form.season_id ? parseInt(form.season_id, 10) : null,
          role: form.role,
          is_active: form.is_active === '1',
          start_date: nullableString(form.start_date),
          end_date: nullableString(form.end_date),
        };
        const res = await authFetch(`/coaches/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await parseJsonOrThrow(res);
        setSuccess('Назначение обновлено.');
      } else {
        const payload: Record<string, unknown> = {
          team_id: parseInt(form.team_id, 10),
          season_id: form.season_id ? parseInt(form.season_id, 10) : null,
          role: form.role,
          is_active: form.is_active === '1',
          start_date: nullableString(form.start_date),
          end_date: nullableString(form.end_date),
        };

        if (showInlineCoach) {
          payload.inline_coach = {
            first_name: inlineCoachForm.first_name.trim(),
            last_name: inlineCoachForm.last_name.trim(),
            first_name_kz: nullableString(inlineCoachForm.first_name_kz),
            first_name_ru: nullableString(inlineCoachForm.first_name_ru),
            first_name_en: nullableString(inlineCoachForm.first_name_en),
            last_name_kz: nullableString(inlineCoachForm.last_name_kz),
            last_name_ru: nullableString(inlineCoachForm.last_name_ru),
            last_name_en: nullableString(inlineCoachForm.last_name_en),
            photo_url: nullableString(inlineCoachForm.photo_url),
            country_id: inlineCoachForm.country_id ? parseInt(inlineCoachForm.country_id, 10) : null,
          };
        } else {
          payload.coach_id = parseInt(form.coach_id, 10);
        }

        const res = await authFetch('/coaches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await parseJsonOrThrow(res);
        setSuccess('Назначение создано.');
        resetForm();
        await loadMeta();
      }
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить назначение');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: AdminCoachAssignmentListItem) => {
    const name = coachDisplayName(meta, item.coach_id);
    if (!window.confirm(`Удалить назначение ${name} → ${item.team_name ?? item.team_id}?`)) return;
    setDeletingId(item.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await authFetch(`/coaches/${item.id}`, { method: 'DELETE' });
      await parseJsonOrThrow(res);
      setSuccess('Назначение удалено.');
      if (editingId === item.id) resetForm();
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить назначение');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Bulk copy ──────────────────────────────────────────────────────────────

  const loadCopyPreview = async () => {
    if (!copySource || !copyTeam) return;
    setCopyLoading(true);
    setCopyResult(null);
    try {
      const res = await authFetch(`/coaches?season_id=${copySource}&team_id=${copyTeam}&limit=200`);
      const data = (await parseJsonOrThrow(res)) as AdminCoachAssignmentsListResponse;
      setCopyPreview(data.items);
      setCopyExcluded(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить тренеров');
    } finally {
      setCopyLoading(false);
    }
  };

  const executeBulkCopy = async () => {
    if (!copySource || !copyTarget || !copyTeam) return;
    setCopyLoading(true);
    setCopyResult(null);
    setError(null);
    try {
      const excluded_coach_ids = copyPreview
        .filter((c) => copyExcluded.has(c.id))
        .map((c) => c.coach_id);

      const payload: Record<string, unknown> = {
        source_season_id: parseInt(copySource, 10),
        target_season_id: parseInt(copyTarget, 10),
        team_id: parseInt(copyTeam, 10),
        excluded_coach_ids,
      };
      if (copyOverrideRole) {
        payload.override_role = copyOverrideRole;
      }

      const res = await authFetch('/coaches/bulk-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await parseJsonOrThrow(res)) as AdminCoachBulkCopyResponse;
      setCopyResult(data);
      setSuccess(`Перенос завершён: создано ${data.created}, пропущено ${data.skipped}, исключено ${data.excluded}`);
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка массового переноса');
    } finally {
      setCopyLoading(false);
    }
  };

  const toggleCopyExcluded = (id: number) => {
    setCopyExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyFilters = () => {
    setPageOffset(0);
    void loadAssignments();
  };

  const resetFilters = () => {
    setFilterTeam('');
    setFilterSeason('');
    setFilterCoach('');
    setFilterRole('');
    setFilterActive('');
    setPageOffset(0);
  };

  if (!canManage) {
    return <div className="card text-sm text-admin-muted">Раздел доступен только superadmin/editor.</div>;
  }

  const totalPages = Math.ceil(total / pageLimit);
  const currentPage = Math.floor(pageOffset / pageLimit) + 1;
  const isCreating = showForm && editingId === null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-heading)] text-2xl">Тренеры / Назначения</h1>
          <p className="mt-1 text-sm text-admin-muted">
            Управление назначениями тренерского штаба на команды и сезоны.
          </p>
        </div>
        <button className="btn btn-primary shrink-0" type="button" onClick={startAdd}>
          + Добавить назначение
        </button>
      </section>

      {/* Messages */}
      {error && <div className="card border-red-500/40 bg-red-500/10 text-sm text-red-400">{error}</div>}
      {success && <div className="card border-green-500/40 bg-green-500/10 text-sm text-green-400">{success}</div>}

      {/* Form */}
      {showForm && (
        <section className="card">
          <h2 className="mb-4 font-[var(--font-heading)] text-xl">
            {editingId !== null ? `Редактирование назначения #${editingId}` : 'Новое назначение'}
          </h2>
          <form className="space-y-4" onSubmit={onSubmit}>
            {/* Active checkbox */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active === '1'}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked ? '1' : '0' }))}
                />
                Активен
              </label>
            </div>

            {/* Coach selection (only for create) */}
            {editingId === null && !showInlineCoach && (
              <div className="space-y-1">
                <label className="text-sm text-admin-muted">Тренер</label>
                <Combobox
                  options={[
                    { value: '', label: '— Выберите тренера —' },
                    ...meta.coaches.map((c) => ({
                      value: c.id.toString(),
                      label: [c.last_name, c.first_name].filter(Boolean).join(' ') || `#${c.id}`,
                    })),
                  ]}
                  value={form.coach_id}
                  onChange={(v) => setForm((p) => ({ ...p, coach_id: v }))}
                  placeholder="— Выберите тренера —"
                  searchPlaceholder="Поиск по фамилии/имени..."
                />
                <button
                  type="button"
                  className="mt-1 text-xs text-admin-accent hover:underline"
                  onClick={() => setShowInlineCoach(true)}
                >
                  + Создать нового тренера
                </button>
              </div>
            )}

            {/* Inline coach creation form */}
            {editingId === null && showInlineCoach && (
              <div className="rounded-lg border border-admin-line bg-[#0E172A] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Новый тренер</h3>
                  <button
                    type="button"
                    className="text-xs text-admin-muted hover:text-admin-text"
                    onClick={() => {
                      setShowInlineCoach(false);
                      setInlineCoachForm(emptyInlineCoachForm());
                    }}
                  >
                    Отмена — выбрать существующего
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="field"
                    value={inlineCoachForm.last_name}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, last_name: e.target.value }))}
                    placeholder="Фамилия *"
                    required
                  />
                  <input
                    className="field"
                    value={inlineCoachForm.first_name}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, first_name: e.target.value }))}
                    placeholder="Имя *"
                    required
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="field"
                    value={inlineCoachForm.last_name_kz}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, last_name_kz: e.target.value }))}
                    placeholder="Фамилия (KZ)"
                  />
                  <input
                    className="field"
                    value={inlineCoachForm.first_name_kz}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, first_name_kz: e.target.value }))}
                    placeholder="Имя (KZ)"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="field"
                    value={inlineCoachForm.last_name_ru}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, last_name_ru: e.target.value }))}
                    placeholder="Фамилия (RU)"
                  />
                  <input
                    className="field"
                    value={inlineCoachForm.first_name_ru}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, first_name_ru: e.target.value }))}
                    placeholder="Имя (RU)"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="field"
                    value={inlineCoachForm.last_name_en}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, last_name_en: e.target.value }))}
                    placeholder="Фамилия (EN)"
                  />
                  <input
                    className="field"
                    value={inlineCoachForm.first_name_en}
                    onChange={(e) => setInlineCoachForm((p) => ({ ...p, first_name_en: e.target.value }))}
                    placeholder="Имя (EN)"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-admin-muted">Страна</label>
                    <Combobox
                      options={[
                        { value: '', label: '— Страна —' },
                        ...meta.countries.map((c) => ({
                          value: c.id.toString(),
                          label: c.name,
                        })),
                      ]}
                      value={inlineCoachForm.country_id}
                      onChange={(v) => setInlineCoachForm((p) => ({ ...p, country_id: v }))}
                      placeholder="— Страна —"
                      searchPlaceholder="Поиск страны..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-admin-muted">Фото</label>
                    <div className="flex gap-2 items-center">
                      {inlineCoachForm.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={inlineCoachForm.photo_url} alt="Фото" className="h-10 w-10 rounded object-cover shrink-0" />
                      )}
                      <label className="btn btn-muted cursor-pointer shrink-0 text-xs">
                        {inlinePhotoUploading ? 'Загрузка...' : 'Загрузить фото'}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => void handleInlinePhotoUpload(e)}
                          disabled={inlinePhotoUploading}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Role + Season */}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Роль
                <select
                  className="field"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as CoachRoleValue }))}
                >
                  {COACH_ROLES.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Сезон
                <select
                  className="field"
                  value={form.season_id}
                  onChange={(e) => setForm((p) => ({ ...p, season_id: e.target.value }))}
                >
                  <option value="">— Без сезона —</option>
                  {meta.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.championship_name ? `${s.championship_name} — ` : ''}{s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Team */}
            <div className="space-y-1">
              <label className="text-sm text-admin-muted">Команда</label>
              <Combobox
                options={[
                  { value: '', label: '— Команда —' },
                  ...meta.teams.map((t) => ({ value: t.id.toString(), label: t.name })),
                ]}
                value={form.team_id}
                onChange={(v) => setForm((p) => ({ ...p, team_id: v }))}
                placeholder="— Команда —"
                searchPlaceholder="Поиск команды..."
              />
            </div>

            {/* Dates */}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Дата начала
                <input
                  type="date"
                  className="field"
                  value={form.start_date ? form.start_date.slice(0, 10) : ''}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-admin-muted">
                Дата окончания
                <input
                  type="date"
                  className="field"
                  value={form.end_date ? form.end_date.slice(0, 10) : ''}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Сохранение...' : editingId !== null ? 'Сохранить' : 'Создать'}
              </button>
              <button className="btn btn-muted" type="button" onClick={resetForm}>
                Отмена
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Bulk copy panel */}
      {!isCreating && (
        <section className="card">
          <button
            type="button"
            className="text-sm text-admin-accent hover:underline"
            onClick={() => setShowCopyPanel((v) => !v)}
          >
            {showCopyPanel ? 'Скрыть массовый перенос' : 'Массовый перенос тренеров между сезонами'}
          </button>

          {showCopyPanel && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm text-admin-muted">
                  Сезон (источник)
                  <select
                    className="field"
                    value={copySource}
                    onChange={(e) => {
                      setCopySource(e.target.value);
                      setCopyPreview([]);
                      setCopyResult(null);
                    }}
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
                  <Combobox
                    options={[
                      { value: '', label: '— Команда —' },
                      ...meta.teams.map((t) => ({ value: t.id.toString(), label: t.name })),
                    ]}
                    value={copyTeam}
                    onChange={(v) => {
                      setCopyTeam(v);
                      setCopyPreview([]);
                      setCopyResult(null);
                    }}
                    placeholder="— Команда —"
                    searchPlaceholder="Поиск команды..."
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-admin-muted">
                  Сезон (цель)
                  <select
                    className="field"
                    value={copyTarget}
                    onChange={(e) => setCopyTarget(e.target.value)}
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

              <div className="flex gap-2 items-end">
                <label className="flex flex-col gap-1 text-sm text-admin-muted">
                  Переопределить роль (опционально)
                  <select
                    className="field"
                    value={copyOverrideRole}
                    onChange={(e) => setCopyOverrideRole(e.target.value)}
                  >
                    <option value="">— Без изменений —</option>
                    {COACH_ROLES.map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-muted"
                  disabled={!copySource || !copyTeam || copyLoading}
                  onClick={() => void loadCopyPreview()}
                >
                  Загрузить
                </button>
              </div>

              {/* Preview table */}
              {copyPreview.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-admin-line text-left text-xs uppercase tracking-wider text-admin-muted">
                          <th className="p-2">Вкл</th>
                          <th className="p-2">Тренер</th>
                          <th className="p-2">Роль</th>
                        </tr>
                      </thead>
                      <tbody>
                        {copyPreview.map((item) => (
                          <tr key={item.id} className={`border-b border-admin-line/50 ${copyExcluded.has(item.id) ? 'opacity-40' : ''}`}>
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={!copyExcluded.has(item.id)}
                                onChange={() => toggleCopyExcluded(item.id)}
                              />
                            </td>
                            <td className="p-2">
                              {[item.coach_last_name, item.coach_first_name].filter(Boolean).join(' ') || `#${item.coach_id}`}
                            </td>
                            <td className="p-2">{COACH_ROLE_LABELS[item.role] ?? item.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!copyTarget || copyLoading}
                    onClick={() => void executeBulkCopy()}
                  >
                    {copyLoading ? 'Перенос...' : `Перенести (${copyPreview.length - copyExcluded.size})`}
                  </button>
                </>
              )}

              {copyResult && (
                <div className="text-sm text-admin-muted">
                  Результат: создано {copyResult.created}, пропущено {copyResult.skipped}, исключено {copyResult.excluded}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Filters */}
      {!isCreating && (
        <section className="card space-y-3">
          <h2 className="font-[var(--font-heading)] text-lg">Фильтры</h2>
          <div className="grid gap-3 md:grid-cols-5">
            <Combobox
              options={[
                { value: '', label: '— Все команды —' },
                ...meta.teams.map((t) => ({ value: t.id.toString(), label: t.name })),
              ]}
              value={filterTeam}
              onChange={setFilterTeam}
              placeholder="— Все команды —"
              searchPlaceholder="Поиск команды..."
            />
            <select className="field" value={filterSeason} onChange={(e) => setFilterSeason(e.target.value)}>
              <option value="">— Все сезоны —</option>
              {meta.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.championship_name ? `${s.championship_name} — ` : ''}{s.name}
                </option>
              ))}
            </select>
            <Combobox
              options={[
                { value: '', label: '— Все тренеры —' },
                ...meta.coaches.map((c) => ({
                  value: c.id.toString(),
                  label: [c.last_name, c.first_name].filter(Boolean).join(' ') || `#${c.id}`,
                })),
              ]}
              value={filterCoach}
              onChange={setFilterCoach}
              placeholder="— Все тренеры —"
              searchPlaceholder="Поиск тренера..."
            />
            <select className="field" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">— Все роли —</option>
              {COACH_ROLES.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <select className="field" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
              <option value="">— Все статусы —</option>
              <option value="true">Активные</option>
              <option value="false">Неактивные</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn btn-primary text-sm" type="button" onClick={applyFilters}>
              Применить
            </button>
            <button className="btn btn-muted text-sm" type="button" onClick={resetFilters}>
              Сбросить
            </button>
            <label className="ml-auto flex items-center gap-2 text-sm text-admin-muted">
              На странице:
              <select
                className="field w-20"
                value={pageLimit}
                onChange={(e) => {
                  setPageLimit(parseInt(e.target.value, 10));
                  setPageOffset(0);
                }}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {/* Table */}
      {!isCreating && (
        <section className="card overflow-x-auto">
          {loading ? (
            <p className="text-sm text-admin-muted">Загрузка...</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-admin-muted">Нет назначений по заданным фильтрам.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-admin-line text-left text-xs uppercase tracking-wider text-admin-muted">
                    <th className="p-2">ID</th>
                    <th className="p-2">Тренер</th>
                    <th className="p-2">Команда</th>
                    <th className="p-2">Сезон</th>
                    <th className="p-2">Роль</th>
                    <th className="p-2">Активен</th>
                    <th className="p-2">Даты</th>
                    <th className="p-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((item) => (
                    <tr key={item.id} className="border-b border-admin-line/50 hover:bg-[#192640]/50">
                      <td className="p-2 text-admin-muted">{item.id}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {item.coach_photo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.coach_photo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          )}
                          <span>{[item.coach_last_name, item.coach_first_name].filter(Boolean).join(' ') || `#${item.coach_id}`}</span>
                        </div>
                      </td>
                      <td className="p-2">{item.team_name ?? item.team_id}</td>
                      <td className="p-2">{item.season_name ?? (item.season_id ? `#${item.season_id}` : '—')}</td>
                      <td className="p-2">{COACH_ROLE_LABELS[item.role] ?? item.role}</td>
                      <td className="p-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${item.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      </td>
                      <td className="p-2 text-xs text-admin-muted">
                        {item.start_date ? item.start_date.slice(0, 10) : '—'}
                        {' / '}
                        {item.end_date ? item.end_date.slice(0, 10) : '—'}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button
                            className="btn btn-muted px-2 py-1 text-xs"
                            type="button"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger px-2 py-1 text-xs"
                            type="button"
                            onClick={() => void onDelete(item)}
                            disabled={deletingId === item.id}
                          >
                            {deletingId === item.id ? '...' : 'Del'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between text-sm text-admin-muted">
                <span>
                  Показано {pageOffset + 1}–{Math.min(pageOffset + pageLimit, total)} из {total}
                </span>
                <div className="flex gap-1">
                  <button
                    className="btn btn-muted px-3 py-1 text-xs"
                    type="button"
                    disabled={pageOffset === 0}
                    onClick={() => setPageOffset(Math.max(0, pageOffset - pageLimit))}
                  >
                    Назад
                  </button>
                  <span className="flex items-center px-2">
                    {currentPage} / {totalPages || 1}
                  </span>
                  <button
                    className="btn btn-muted px-3 py-1 text-xs"
                    type="button"
                    disabled={pageOffset + pageLimit >= total}
                    onClick={() => setPageOffset(pageOffset + pageLimit)}
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
