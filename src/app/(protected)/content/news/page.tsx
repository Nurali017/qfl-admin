'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import CoverImageUpload from '@/components/CoverImageUpload';
import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

type NewsArticleType = 'NEWS' | 'ANALYTICS' | null;
type MaterialFilterType = 'ALL' | 'NEWS' | 'ANALYTICS' | 'UNCLASSIFIED';

type NewsTranslation = {
  id: number;
  language: 'ru' | 'kz';
  title: string;
  excerpt?: string | null;
  content?: string | null;
  content_text?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  championship_code?: string | null;
  article_type?: NewsArticleType;
  is_slider?: boolean;
  slider_order?: number | null;
  publish_date?: string | null;
  source_url?: string | null;
};

type NewsMaterial = {
  group_id: string;
  ru: NewsTranslation | null;
  kz: NewsTranslation | null;
  updated_at?: string | null;
};

type TranslationFormState = {
  title: string;
  excerpt: string;
  content: string;
  content_text: string;
};

type CommonFormState = {
  article_type: NewsArticleType;
  championship_code: string;
  is_slider: boolean;
  slider_order: string;
  publish_date: string;
  video_url: string;
  image_url: string;
  image_preview_url: string;
};

const ARTICLE_TYPE_OPTIONS: Array<{ label: string; value: NewsArticleType }> = [
  { label: 'Unclassified', value: null },
  { label: 'NEWS', value: 'NEWS' },
  { label: 'ANALYTICS', value: 'ANALYTICS' },
];

const CHAMPIONSHIP_OPTIONS = [
  { label: '— Не выбрано —', value: '' },
  { label: 'Премьер-лига', value: 'pl' },
  { label: 'Первая лига', value: '1l' },
  { label: 'Вторая лига', value: '2l' },
  { label: 'Кубок', value: 'cup' },
  { label: 'Элитная лига', value: 'el' },
];

const PER_PAGE = 20;

function normalizeArticleType(value: unknown): NewsArticleType {
  if (value === 'NEWS' || value === 'ANALYTICS') return value;
  return null;
}

export default function NewsMaterialsPage() {
  const { authFetch } = useAuth();
  const [materials, setMaterials] = useState<NewsMaterial[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [page, setPage] = useState(1);
  const [materialFilter, setMaterialFilter] = useState<MaterialFilterType>('ALL');
  const [materialSearch, setMaterialSearch] = useState('');

  // Create form state
  const [createRu, setCreateRu] = useState<TranslationFormState>({ title: '', excerpt: '', content: '', content_text: '' });
  const [createKz, setCreateKz] = useState<TranslationFormState>({ title: '', excerpt: '', content: '', content_text: '' });
  const [createCommon, setCreateCommon] = useState<CommonFormState>({
    article_type: null,
    championship_code: '',
    is_slider: false,
    slider_order: '',
    publish_date: new Date().toISOString().slice(0, 10),
    video_url: '',
    image_url: '',
    image_preview_url: '',
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const loadMaterials = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(targetPage), per_page: String(PER_PAGE) });
      if (materialFilter !== 'ALL') query.set('article_type', materialFilter);
      if (materialSearch.trim()) query.set('search', materialSearch.trim());

      const response = await authFetch(`/news/materials?${query.toString()}`);
      const data = (await parseJsonOrThrow(response)) as { items: NewsMaterial[]; total: number };
      setMaterials(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  }, [authFetch, materialFilter, materialSearch]);

  const deleteMaterial = async (groupId: string) => {
    const response = await authFetch(`/news/materials/${groupId}`, { method: 'DELETE' });
    await parseJsonOrThrow(response);
    await loadMaterials(page);
  };

  useEffect(() => {
    setPage(1);
  }, [materialFilter, materialSearch]);

  useEffect(() => {
    void loadMaterials(page);
  }, [loadMaterials, page]);

  const buildTranslationPayload = (t: TranslationFormState, common: CommonFormState) => ({
    title: t.title,
    excerpt: t.excerpt || undefined,
    content: t.content || undefined,
    content_text: t.content_text || undefined,
    image_url: common.image_url || undefined,
    video_url: common.video_url || undefined,
    championship_code: common.championship_code || undefined,
    article_type: common.article_type,
    is_slider: common.is_slider,
    slider_order: common.slider_order ? Number(common.slider_order) : undefined,
    publish_date: common.publish_date || undefined,
  });

  const createMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await authFetch('/news/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ru: buildTranslationPayload(createRu, createCommon),
          kz: buildTranslationPayload(createKz, createCommon),
        }),
      });
      await parseJsonOrThrow(response);

      setCreateRu({ title: '', excerpt: '', content: '', content_text: '' });
      setCreateKz({ title: '', excerpt: '', content: '', content_text: '' });
      setCreateCommon({
        article_type: null, championship_code: '', is_slider: false,
        slider_order: '', publish_date: new Date().toISOString().slice(0, 10), video_url: '',
        image_url: '', image_preview_url: '',
      });
      setPage(1);
      await loadMaterials(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать материал');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">News Materials RU + KZ</h1>
        <p className="mt-1 text-sm text-admin-muted">Список двуязычных материалов. Нажмите «Редактировать» для входа в материал.</p>
      </section>

      {/* Create Material — collapsible */}
      <details className="card group">
        <summary className="cursor-pointer font-[var(--font-heading)] text-xl select-none list-none flex items-center justify-between">
          <span>Создать материал</span>
          <span className="text-admin-muted text-sm group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <form className="mt-4 space-y-4" onSubmit={createMaterial}>
          {/* Common settings */}
          <div className="rounded-lg border border-admin-line p-3 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">Общие настройки</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-admin-muted">Тип статьи</label>
                <select
                  className="field"
                  value={createCommon.article_type ?? ''}
                  onChange={(e) => setCreateCommon({ ...createCommon, article_type: normalizeArticleType(e.target.value || null) })}
                >
                  {ARTICLE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-admin-muted">Чемпионат</label>
                <select
                  className="field"
                  value={createCommon.championship_code}
                  onChange={(e) => setCreateCommon({ ...createCommon, championship_code: e.target.value })}
                >
                  {CHAMPIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-admin-muted">Дата публикации</label>
                <input
                  type="date"
                  className="field"
                  value={createCommon.publish_date}
                  onChange={(e) => setCreateCommon({ ...createCommon, publish_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-admin-muted">Video URL</label>
                <input
                  className="field"
                  placeholder="https://youtube.com/..."
                  value={createCommon.video_url}
                  onChange={(e) => setCreateCommon({ ...createCommon, video_url: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-admin-muted self-end py-2">
                <input
                  type="checkbox"
                  checked={createCommon.is_slider}
                  onChange={(e) => setCreateCommon({ ...createCommon, is_slider: e.target.checked })}
                />
                Слайдер
              </label>
              {createCommon.is_slider && (
                <div className="space-y-1">
                  <label className="text-xs text-admin-muted">Порядок в слайдере</label>
                  <input
                    type="number"
                    className="field"
                    placeholder="1"
                    value={createCommon.slider_order}
                    onChange={(e) => setCreateCommon({ ...createCommon, slider_order: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Cover Image */}
          <div className="rounded-lg border border-admin-line p-3">
            <CoverImageUpload
              currentUrl={createCommon.image_preview_url}
              onUpload={(objectName, url) => setCreateCommon({ ...createCommon, image_url: objectName, image_preview_url: url })}
              onRemove={() => setCreateCommon({ ...createCommon, image_url: '', image_preview_url: '' })}
            />
          </div>

          {/* RU / KZ translations */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-admin-line p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">RU</p>
              <input
                className="field"
                placeholder="Заголовок RU"
                value={createRu.title}
                onChange={(e) => setCreateRu({ ...createRu, title: e.target.value })}
                required
              />
              <textarea
                className="field min-h-16"
                placeholder="Анонс / excerpt RU"
                value={createRu.excerpt}
                onChange={(e) => setCreateRu({ ...createRu, excerpt: e.target.value })}
                rows={2}
              />
              <label className="text-xs text-admin-muted">Контент RU</label>
              <RichTextEditor
                value={createRu.content}
                onChange={(html, text) => setCreateRu({ ...createRu, content: html, content_text: text })}
                placeholder="Контент RU..."
              />
            </div>

            <div className="space-y-2 rounded-lg border border-admin-line p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">KZ</p>
              <input
                className="field"
                placeholder="Заголовок KZ"
                value={createKz.title}
                onChange={(e) => setCreateKz({ ...createKz, title: e.target.value })}
                required
              />
              <textarea
                className="field min-h-16"
                placeholder="Анонс / excerpt KZ"
                value={createKz.excerpt}
                onChange={(e) => setCreateKz({ ...createKz, excerpt: e.target.value })}
                rows={2}
              />
              <label className="text-xs text-admin-muted">Контент KZ</label>
              <RichTextEditor
                value={createKz.content}
                onChange={(html, text) => setCreateKz({ ...createKz, content: html, content_text: text })}
                placeholder="Контент KZ..."
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Сохраняем...' : 'Создать материал'}
          </button>
        </form>
      </details>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      {/* List filters */}
      <section className="card space-y-3">
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
          <button type="button" className="btn btn-muted" onClick={() => void loadMaterials(page)} disabled={loading}>
            {loading ? 'Загружаем...' : 'Обновить'}
          </button>
        </div>
        <p className="text-xs text-admin-muted">Всего: {total} материалов</p>
      </section>

      {/* Material list */}
      <section className="card">
        {loading ? (
          <div className="text-sm text-admin-muted">Загружаем...</div>
        ) : materials.length === 0 ? (
          <div className="text-sm text-admin-muted">Материалов нет.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-line text-left text-xs uppercase text-admin-muted">
                  <th className="px-2 py-2 w-14"></th>
                  <th className="px-2 py-2">Заголовок</th>
                  <th className="px-2 py-2">Тип</th>
                  <th className="px-2 py-2">Чемп.</th>
                  <th className="px-2 py-2">Дата</th>
                  <th className="px-2 py-2">Языки</th>
                  <th className="px-2 py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <NewsListRow key={material.group_id} material={material} onDelete={deleteMaterial} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <section className="card flex items-center justify-between gap-4">
          <button
            type="button"
            className="btn btn-muted"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            ← Пред.
          </button>
          <span className="text-sm text-admin-muted">
            Страница {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-muted"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            След. →
          </button>
        </section>
      )}
    </div>
  );
}

/* ---------- Compact list row ---------- */

const CHAMPIONSHIP_LABEL: Record<string, string> = {
  pl: 'Премьер-лига',
  '1l': 'Первая лига',
  '2l': 'Вторая лига',
  cup: 'Кубок',
  el: 'Элитная лига',
};

function ArticleTypeBadge({ type }: { type: NewsArticleType }) {
  if (type === 'NEWS') return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-blue-900/50 text-blue-300">NEWS</span>;
  if (type === 'ANALYTICS') return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-purple-900/50 text-purple-300">ANALYTICS</span>;
  return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-admin-line text-admin-muted">—</span>;
}

function NewsListRow({
  material,
  onDelete,
}: {
  material: NewsMaterial;
  onDelete: (groupId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const title = material.ru?.title ?? material.kz?.title ?? '—';
  const articleType = (material.ru?.article_type ?? material.kz?.article_type) as NewsArticleType ?? null;
  const championshipCode = material.ru?.championship_code ?? material.kz?.championship_code;
  const publishDate = material.ru?.publish_date ?? material.kz?.publish_date;
  const imageUrl = material.ru?.image_url ?? material.kz?.image_url;

  const handleDelete = async () => {
    if (!confirm('Удалить материал полностью (RU+KZ)?')) return;
    setBusy(true);
    try {
      await onDelete(material.group_id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b border-admin-line/50 hover:bg-[#192640]/50">
      <td className="px-2 py-2">
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={48} height={36} className="h-9 w-14 rounded object-cover" unoptimized />
        ) : (
          <div className="h-9 w-14 rounded bg-admin-line/40" />
        )}
      </td>
      <td className="px-2 py-2 max-w-xs">
        <span className="line-clamp-2 leading-snug text-sm">{title}</span>
      </td>
      <td className="px-2 py-2">
        <ArticleTypeBadge type={articleType} />
      </td>
      <td className="px-2 py-2 text-xs text-admin-muted">
        {championshipCode ? (CHAMPIONSHIP_LABEL[championshipCode] ?? championshipCode) : '—'}
      </td>
      <td className="px-2 py-2 text-xs text-admin-muted whitespace-nowrap">
        {publishDate ? String(publishDate).slice(0, 10) : '—'}
      </td>
      <td className="px-2 py-2 text-xs">
        <span className={material.ru ? 'text-white' : 'text-admin-muted/40'}>RU</span>
        {' / '}
        <span className={material.kz ? 'text-white' : 'text-admin-muted/40'}>KZ</span>
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <Link
            href={`/content/news/${material.group_id}`}
            className="rounded bg-admin-line px-2 py-0.5 text-xs text-admin-muted hover:bg-[#2a3a5c]"
          >
            Открыть
          </Link>
          <button
            type="button"
            className="rounded bg-red-700/70 px-2 py-0.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
            onClick={() => void handleDelete()}
            disabled={busy}
          >
            {busy ? '...' : 'Del'}
          </button>
        </div>
      </td>
    </tr>
  );
}
