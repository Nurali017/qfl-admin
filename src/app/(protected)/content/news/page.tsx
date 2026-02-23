'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type NewsArticleType = 'NEWS' | 'ANALYTICS' | null;
type MaterialFilterType = 'ALL' | 'NEWS' | 'ANALYTICS' | 'UNCLASSIFIED';

type NewsTranslation = {
  id: number;
  language: 'ru' | 'kz';
  title: string;
  excerpt?: string | null;
  content?: string | null;
  article_type?: NewsArticleType;
};

type NewsMaterial = {
  group_id: string;
  ru: NewsTranslation | null;
  kz: NewsTranslation | null;
  updated_at?: string | null;
};

type ClassifyNeedsReviewItem = {
  group_id: string;
  representative_news_id?: number | null;
  representative_title?: string | null;
  confidence: number;
  source: string;
  reason?: string | null;
};

type ClassifySummary = {
  dry_run: boolean;
  total_groups: number;
  classified_groups: number;
  updated_groups: number;
  unchanged_groups: number;
  needs_review_count: number;
};

type ClassifyResponse = {
  summary: ClassifySummary;
  needs_review: ClassifyNeedsReviewItem[];
  updated_group_ids: string[];
};

const ARTICLE_TYPE_OPTIONS: Array<{ label: string; value: NewsArticleType }> = [
  { label: 'Unclassified', value: null },
  { label: 'NEWS', value: 'NEWS' },
  { label: 'ANALYTICS', value: 'ANALYTICS' },
];

function normalizeArticleType(value: unknown): NewsArticleType {
  if (value === 'NEWS' || value === 'ANALYTICS') return value;
  return null;
}

function materialArticleType(material: NewsMaterial): NewsArticleType {
  return normalizeArticleType(material.ru?.article_type ?? material.kz?.article_type ?? null);
}

export default function NewsMaterialsPage() {
  const { authFetch } = useAuth();
  const [materials, setMaterials] = useState<NewsMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [materialFilter, setMaterialFilter] = useState<MaterialFilterType>('ALL');
  const [materialSearch, setMaterialSearch] = useState('');

  const [createRuTitle, setCreateRuTitle] = useState('');
  const [createRuContent, setCreateRuContent] = useState('');
  const [createKzTitle, setCreateKzTitle] = useState('');
  const [createKzContent, setCreateKzContent] = useState('');
  const [createArticleType, setCreateArticleType] = useState<NewsArticleType>(null);

  const [classifyLimit, setClassifyLimit] = useState('');
  const [classifyOnlyUnclassified, setClassifyOnlyUnclassified] = useState(true);
  const [classifyMinConfidence, setClassifyMinConfidence] = useState('0.70');
  const [classifyBusy, setClassifyBusy] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [classifyResult, setClassifyResult] = useState<ClassifyResponse | null>(null);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: '1',
        per_page: '100',
      });
      if (materialFilter !== 'ALL') {
        query.set('article_type', materialFilter);
      }
      if (materialSearch.trim()) {
        query.set('search', materialSearch.trim());
      }

      const response = await authFetch(`/news/materials?${query.toString()}`);
      const data = (await parseJsonOrThrow(response)) as { items: NewsMaterial[] };
      setMaterials(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  }, [authFetch, materialFilter, materialSearch]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const createMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await authFetch('/news/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ru: {
            title: createRuTitle,
            content: createRuContent,
            article_type: createArticleType,
            is_slider: false,
          },
          kz: {
            title: createKzTitle,
            content: createKzContent,
            article_type: createArticleType,
            is_slider: false,
          },
        }),
      });
      await parseJsonOrThrow(response);

      setCreateRuTitle('');
      setCreateRuContent('');
      setCreateKzTitle('');
      setCreateKzContent('');
      setCreateArticleType(null);
      await loadMaterials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать материал');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTranslation = async (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: { title: string; content: string; excerpt?: string; article_type: NewsArticleType }
  ) => {
    const response = await authFetch(`/news/materials/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [lang]: {
          title: payload.title,
          content: payload.content,
          excerpt: payload.excerpt,
          article_type: payload.article_type,
          is_slider: false,
        },
      }),
    });
    await parseJsonOrThrow(response);
    await loadMaterials();
  };

  const addMissingTranslation = async (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: { title: string; content: string; article_type: NewsArticleType }
  ) => {
    const response = await authFetch(`/news/materials/${groupId}/translation/${lang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          title: payload.title,
          content: payload.content,
          article_type: payload.article_type,
          is_slider: false,
        },
      }),
    });
    await parseJsonOrThrow(response);
    await loadMaterials();
  };

  const setMaterialType = async (groupId: string, articleType: NewsArticleType) => {
    const response = await authFetch(`/news/materials/${groupId}/article-type`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_type: articleType }),
    });
    await parseJsonOrThrow(response);
    await loadMaterials();
  };

  const deleteMaterial = async (groupId: string) => {
    const response = await authFetch(`/news/materials/${groupId}`, { method: 'DELETE' });
    await parseJsonOrThrow(response);
    await loadMaterials();
  };

  const runClassification = async (apply: boolean) => {
    setClassifyBusy(true);
    setClassifyError(null);
    try {
      const limit = classifyLimit.trim() ? Number(classifyLimit) : null;
      const minConfidence = Number(classifyMinConfidence);
      const response = await authFetch('/news/materials/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apply,
          only_unclassified: classifyOnlyUnclassified,
          limit: Number.isFinite(limit as number) ? limit : null,
          min_confidence: Number.isFinite(minConfidence) ? minConfidence : 0.7,
        }),
      });
      const data = (await parseJsonOrThrow(response)) as ClassifyResponse;
      setClassifyResult(data);
      await loadMaterials();
    } catch (err) {
      setClassifyError(err instanceof Error ? err.message : 'Не удалось запустить классификацию');
    } finally {
      setClassifyBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">News Materials RU + KZ</h1>
        <p className="mt-1 text-sm text-admin-muted">Создание, фильтрация и классификация двуязычных материалов.</p>
      </section>

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">Классификация</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="field"
            value={classifyLimit}
            onChange={(e) => setClassifyLimit(e.target.value)}
            placeholder="limit (пусто = без лимита)"
            inputMode="numeric"
          />
          <input
            className="field"
            value={classifyMinConfidence}
            onChange={(e) => setClassifyMinConfidence(e.target.value)}
            placeholder="min confidence (0..1)"
            inputMode="decimal"
          />
          <label className="flex items-center gap-2 text-sm text-admin-muted">
            <input
              type="checkbox"
              checked={classifyOnlyUnclassified}
              onChange={(e) => setClassifyOnlyUnclassified(e.target.checked)}
            />
            Только unclassified
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-muted"
              onClick={() => void runClassification(false)}
              disabled={classifyBusy}
            >
              {classifyBusy ? 'Running...' : 'Dry run'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void runClassification(true)}
              disabled={classifyBusy}
            >
              {classifyBusy ? 'Running...' : 'Apply'}
            </button>
          </div>
        </div>

        {classifyError ? <p className="mt-3 text-sm text-red-300">{classifyError}</p> : null}

        {classifyResult ? (
          <div className="mt-4 space-y-3 rounded-lg border border-admin-line p-3">
            <p className="text-sm text-admin-muted">
              mode: <b>{classifyResult.summary.dry_run ? 'dry-run' : 'apply'}</b> · groups:{' '}
              <b>{classifyResult.summary.total_groups}</b> · classified: <b>{classifyResult.summary.classified_groups}</b> ·
              updated: <b>{classifyResult.summary.updated_groups}</b> · needs review:{' '}
              <b>{classifyResult.summary.needs_review_count}</b>
            </p>
            {classifyResult.needs_review.length > 0 ? (
              <div className="space-y-1 text-xs text-admin-muted">
                {classifyResult.needs_review.slice(0, 20).map((item) => (
                  <div key={`${item.group_id}-${item.representative_news_id ?? 'none'}`} className="rounded border border-admin-line p-2">
                    <div>group: {item.group_id}</div>
                    <div>title: {item.representative_title || '—'}</div>
                    <div>
                      confidence: {item.confidence.toFixed(2)} · source: {item.source} · reason: {item.reason || '—'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-admin-muted">Нет материалов в очереди ревью.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">Создать материал</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={createMaterial}>
          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs uppercase tracking-[0.18em] text-admin-muted">Article type</label>
            <select
              className="field"
              value={createArticleType ?? ''}
              onChange={(e) => setCreateArticleType(normalizeArticleType(e.target.value || null))}
            >
              {ARTICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value ?? ''}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">RU</p>
            <input
              className="field"
              placeholder="RU title"
              value={createRuTitle}
              onChange={(e) => setCreateRuTitle(e.target.value)}
              required
            />
            <textarea
              className="field min-h-28"
              placeholder="RU content"
              value={createRuContent}
              onChange={(e) => setCreateRuContent(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">KZ</p>
            <input
              className="field"
              placeholder="KZ title"
              value={createKzTitle}
              onChange={(e) => setCreateKzTitle(e.target.value)}
              required
            />
            <textarea
              className="field min-h-28"
              placeholder="KZ content"
              value={createKzContent}
              onChange={(e) => setCreateKzContent(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary lg:col-span-2" disabled={submitting}>
            {submitting ? 'Сохраняем...' : 'Создать материал'}
          </button>
        </form>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      <section className="card space-y-3">
        <h2 className="font-[var(--font-heading)] text-xl">Фильтры списка</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="field"
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value as MaterialFilterType)}
          >
            <option value="ALL">Все</option>
            <option value="NEWS">Новости</option>
            <option value="ANALYTICS">Аналитика</option>
            <option value="UNCLASSIFIED">На ревью (unclassified)</option>
          </select>
          <input
            className="field"
            value={materialSearch}
            onChange={(e) => setMaterialSearch(e.target.value)}
            placeholder="Поиск по title/excerpt/content"
          />
          <button type="button" className="btn btn-muted" onClick={() => void loadMaterials()} disabled={loading}>
            {loading ? 'Загружаем...' : 'Обновить'}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? <div className="card text-sm text-admin-muted">Загружаем...</div> : null}
        {!loading && materials.length === 0 ? <div className="card text-sm text-admin-muted">Материалов пока нет.</div> : null}

        {materials.map((material) => (
          <NewsMaterialCard
            key={material.group_id}
            material={material}
            onUpdate={updateTranslation}
            onAddTranslation={addMissingTranslation}
            onSetArticleType={setMaterialType}
            onDelete={deleteMaterial}
          />
        ))}
      </section>
    </div>
  );
}

function NewsMaterialCard({
  material,
  onUpdate,
  onAddTranslation,
  onSetArticleType,
  onDelete,
}: {
  material: NewsMaterial;
  onUpdate: (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: { title: string; content: string; excerpt?: string; article_type: NewsArticleType }
  ) => Promise<void>;
  onAddTranslation: (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: { title: string; content: string; article_type: NewsArticleType }
  ) => Promise<void>;
  onSetArticleType: (groupId: string, articleType: NewsArticleType) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
}) {
  const [ruTitle, setRuTitle] = useState(material.ru?.title || '');
  const [ruContent, setRuContent] = useState(material.ru?.content || '');
  const [kzTitle, setKzTitle] = useState(material.kz?.title || '');
  const [kzContent, setKzContent] = useState(material.kz?.content || '');
  const [articleType, setArticleType] = useState<NewsArticleType>(materialArticleType(material));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRuTitle(material.ru?.title || '');
    setRuContent(material.ru?.content || '');
    setKzTitle(material.kz?.title || '');
    setKzContent(material.kz?.content || '');
    setArticleType(materialArticleType(material));
  }, [material]);

  const submitUpdate = async (lang: 'ru' | 'kz') => {
    setBusy(true);
    setError(null);
    try {
      if (lang === 'ru') {
        await onUpdate(material.group_id, 'ru', { title: ruTitle, content: ruContent, article_type: articleType });
      } else {
        await onUpdate(material.group_id, 'kz', { title: kzTitle, content: kzContent, article_type: articleType });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления');
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = async (lang: 'ru' | 'kz') => {
    setBusy(true);
    setError(null);
    try {
      if (lang === 'ru') {
        await onAddTranslation(material.group_id, 'ru', { title: ruTitle, content: ruContent, article_type: articleType });
      } else {
        await onAddTranslation(material.group_id, 'kz', { title: kzTitle, content: kzContent, article_type: articleType });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления перевода');
    } finally {
      setBusy(false);
    }
  };

  const submitSetType = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSetArticleType(material.group_id, articleType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления типа');
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!confirm('Удалить материал полностью (RU+KZ)?')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onDelete(material.group_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-admin-muted">
        <span>group_id: {material.group_id}</span>
        <div className="flex items-center gap-2">
          <select
            className="field h-9 min-w-[160px]"
            value={articleType ?? ''}
            onChange={(e) => setArticleType(normalizeArticleType(e.target.value || null))}
            disabled={busy}
          >
            {ARTICLE_TYPE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ''}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-muted" onClick={() => void submitSetType()} disabled={busy}>
            Save type
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void submitDelete()} disabled={busy}>
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-admin-line p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-admin-muted">RU</p>
          <input className="field" placeholder="RU title" value={ruTitle} onChange={(e) => setRuTitle(e.target.value)} />
          <textarea className="field min-h-24" placeholder="RU content" value={ruContent} onChange={(e) => setRuContent(e.target.value)} />
          {material.ru ? (
            <button type="button" className="btn btn-muted" onClick={() => void submitUpdate('ru')} disabled={busy || !ruTitle}>
              Save RU
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void submitAdd('ru')} disabled={busy || !ruTitle}>
              Добавить RU перевод
            </button>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-admin-line p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-admin-muted">KZ</p>
          <input className="field" placeholder="KZ title" value={kzTitle} onChange={(e) => setKzTitle(e.target.value)} />
          <textarea className="field min-h-24" placeholder="KZ content" value={kzContent} onChange={(e) => setKzContent(e.target.value)} />
          {material.kz ? (
            <button type="button" className="btn btn-muted" onClick={() => void submitUpdate('kz')} disabled={busy || !kzTitle}>
              Save KZ
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void submitAdd('kz')} disabled={busy || !kzTitle}>
              Добавить KZ перевод
            </button>
          )}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-admin-danger/50 bg-admin-danger/10 p-2 text-sm">{error}</div> : null}
    </article>
  );
}
