'use client';

import dynamic from 'next/dynamic';
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

function normalizeArticleType(value: unknown): NewsArticleType {
  if (value === 'NEWS' || value === 'ANALYTICS') return value;
  return null;
}

function materialArticleType(material: NewsMaterial): NewsArticleType {
  return normalizeArticleType(material.ru?.article_type ?? material.kz?.article_type ?? null);
}

function getCommonField<T>(material: NewsMaterial, field: keyof NewsTranslation): T | undefined {
  const ru = material.ru?.[field];
  const kz = material.kz?.[field];
  return (ru ?? kz) as T | undefined;
}

export default function NewsMaterialsPage() {
  const { authFetch } = useAuth();
  const [materials, setMaterials] = useState<NewsMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: '1', per_page: '100' });
      if (materialFilter !== 'ALL') query.set('article_type', materialFilter);
      if (materialSearch.trim()) query.set('search', materialSearch.trim());

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
    payload: Record<string, unknown>,
  ) => {
    const response = await authFetch(`/news/materials/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [lang]: payload }),
    });
    await parseJsonOrThrow(response);
    await loadMaterials();
  };

  const addMissingTranslation = async (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: Record<string, unknown>,
  ) => {
    const response = await authFetch(`/news/materials/${groupId}/translation/${lang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload }),
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">News Materials RU + KZ</h1>
        <p className="mt-1 text-sm text-admin-muted">Создание и редактирование двуязычных материалов.</p>
      </section>

      {/* Create Material */}
      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">Создать материал</h2>
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
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      {/* List filters */}
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

      {/* Material list */}
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

/* ---------- Material Card ---------- */

function NewsMaterialCard({
  material,
  onUpdate,
  onAddTranslation,
  onSetArticleType,
  onDelete,
}: {
  material: NewsMaterial;
  onUpdate: (groupId: string, lang: 'ru' | 'kz', payload: Record<string, unknown>) => Promise<void>;
  onAddTranslation: (groupId: string, lang: 'ru' | 'kz', payload: Record<string, unknown>) => Promise<void>;
  onSetArticleType: (groupId: string, articleType: NewsArticleType) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
}) {
  const [ruTitle, setRuTitle] = useState(material.ru?.title || '');
  const [ruExcerpt, setRuExcerpt] = useState(material.ru?.excerpt || '');
  const [ruContent, setRuContent] = useState(material.ru?.content || '');
  const [ruContentText, setRuContentText] = useState(material.ru?.content_text || '');

  const [kzTitle, setKzTitle] = useState(material.kz?.title || '');
  const [kzExcerpt, setKzExcerpt] = useState(material.kz?.excerpt || '');
  const [kzContent, setKzContent] = useState(material.kz?.content || '');
  const [kzContentText, setKzContentText] = useState(material.kz?.content_text || '');

  const [articleType, setArticleType] = useState<NewsArticleType>(materialArticleType(material));
  const [championshipCode, setChampionshipCode] = useState(getCommonField<string>(material, 'championship_code') || '');
  const [publishDate, setPublishDate] = useState(() => {
    const d = getCommonField<string>(material, 'publish_date');
    return d ? d.slice(0, 10) : '';
  });
  const [videoUrl, setVideoUrl] = useState(getCommonField<string>(material, 'video_url') || '');
  const [isSlider, setIsSlider] = useState(getCommonField<boolean>(material, 'is_slider') || false);
  const [sliderOrder, setSliderOrder] = useState(() => {
    const v = getCommonField<number>(material, 'slider_order');
    return v != null ? String(v) : '';
  });
  const [imageUrl, setImageUrl] = useState(getCommonField<string>(material, 'image_url') || '');
  const [imagePreviewUrl, setImagePreviewUrl] = useState(getCommonField<string>(material, 'image_url') || '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRuTitle(material.ru?.title || '');
    setRuExcerpt(material.ru?.excerpt || '');
    setRuContent(material.ru?.content || '');
    setRuContentText(material.ru?.content_text || '');
    setKzTitle(material.kz?.title || '');
    setKzExcerpt(material.kz?.excerpt || '');
    setKzContent(material.kz?.content || '');
    setKzContentText(material.kz?.content_text || '');
    setArticleType(materialArticleType(material));
    setChampionshipCode(getCommonField<string>(material, 'championship_code') || '');
    const d = getCommonField<string>(material, 'publish_date');
    setPublishDate(d ? d.slice(0, 10) : '');
    setVideoUrl(getCommonField<string>(material, 'video_url') || '');
    setIsSlider(getCommonField<boolean>(material, 'is_slider') || false);
    const so = getCommonField<number>(material, 'slider_order');
    setSliderOrder(so != null ? String(so) : '');
    setImageUrl(getCommonField<string>(material, 'image_url') || '');
    setImagePreviewUrl(getCommonField<string>(material, 'image_url') || '');
  }, [material]);

  const buildCommonFields = () => ({
    image_url: imageUrl || undefined,
    video_url: videoUrl || undefined,
    championship_code: championshipCode || undefined,
    is_slider: isSlider,
    slider_order: sliderOrder ? Number(sliderOrder) : undefined,
    publish_date: publishDate || undefined,
  });

  const submitSaveLang = async (lang: 'ru' | 'kz') => {
    setBusy(true);
    setError(null);
    try {
      const title = lang === 'ru' ? ruTitle : kzTitle;
      const excerpt = lang === 'ru' ? ruExcerpt : kzExcerpt;
      const content = lang === 'ru' ? ruContent : kzContent;
      const contentText = lang === 'ru' ? ruContentText : kzContentText;

      const payload = {
        title,
        excerpt: excerpt || undefined,
        content: content || undefined,
        content_text: contentText || undefined,
        article_type: articleType,
        ...buildCommonFields(),
      };

      const hasExisting = lang === 'ru' ? material.ru : material.kz;
      if (hasExisting) {
        await onUpdate(material.group_id, lang, payload);
      } else {
        await onAddTranslation(material.group_id, lang, payload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
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
    if (!confirm('Удалить материал полностью (RU+KZ)?')) return;
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
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-admin-muted">
        <span>group_id: {material.group_id}</span>
        <div className="flex items-center gap-2">
          <select
            className="field h-9 min-w-[160px]"
            value={articleType ?? ''}
            onChange={(e) => setArticleType(normalizeArticleType(e.target.value || null))}
            disabled={busy}
          >
            {ARTICLE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
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

      {/* Common settings */}
      <div className="rounded-lg border border-admin-line p-3 space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">Общие настройки</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-admin-muted">Чемпионат</label>
            <select className="field" value={championshipCode} onChange={(e) => setChampionshipCode(e.target.value)}>
              {CHAMPIONSHIP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-admin-muted">Дата публикации</label>
            <input type="date" className="field" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-admin-muted">Video URL</label>
            <input className="field" placeholder="https://youtube.com/..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-admin-muted self-end py-2">
            <input type="checkbox" checked={isSlider} onChange={(e) => setIsSlider(e.target.checked)} />
            Слайдер
          </label>
          {isSlider && (
            <div className="space-y-1">
              <label className="text-xs text-admin-muted">Порядок в слайдере</label>
              <input type="number" className="field" placeholder="1" value={sliderOrder} onChange={(e) => setSliderOrder(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Cover Image */}
      <div className="rounded-lg border border-admin-line p-3">
        <CoverImageUpload
          currentUrl={imagePreviewUrl}
          onUpload={(objectName, url) => { setImageUrl(objectName); setImagePreviewUrl(url); }}
          onRemove={() => { setImageUrl(''); setImagePreviewUrl(''); }}
        />
      </div>

      {/* RU / KZ translations */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* RU */}
        <div className="space-y-2 rounded-lg border border-admin-line p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-admin-muted">RU</p>
          <input className="field" placeholder="Заголовок RU" value={ruTitle} onChange={(e) => setRuTitle(e.target.value)} />
          <textarea className="field min-h-16" placeholder="Анонс / excerpt RU" value={ruExcerpt} onChange={(e) => setRuExcerpt(e.target.value)} rows={2} />
          <label className="text-xs text-admin-muted">Контент RU</label>
          <RichTextEditor
            value={ruContent}
            onChange={(html, text) => { setRuContent(html); setRuContentText(text); }}
            placeholder="Контент RU..."
          />
          <button
            type="button"
            className={material.ru ? 'btn btn-muted' : 'btn btn-primary'}
            onClick={() => void submitSaveLang('ru')}
            disabled={busy || !ruTitle}
          >
            {material.ru ? 'Save RU' : 'Добавить RU перевод'}
          </button>
        </div>

        {/* KZ */}
        <div className="space-y-2 rounded-lg border border-admin-line p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-admin-muted">KZ</p>
          <input className="field" placeholder="Заголовок KZ" value={kzTitle} onChange={(e) => setKzTitle(e.target.value)} />
          <textarea className="field min-h-16" placeholder="Анонс / excerpt KZ" value={kzExcerpt} onChange={(e) => setKzExcerpt(e.target.value)} rows={2} />
          <label className="text-xs text-admin-muted">Контент KZ</label>
          <RichTextEditor
            value={kzContent}
            onChange={(html, text) => { setKzContent(html); setKzContentText(text); }}
            placeholder="Контент KZ..."
          />
          <button
            type="button"
            className={material.kz ? 'btn btn-muted' : 'btn btn-primary'}
            onClick={() => void submitSaveLang('kz')}
            disabled={busy || !kzTitle}
          >
            {material.kz ? 'Save KZ' : 'Добавить KZ перевод'}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-admin-danger/50 bg-admin-danger/10 p-2 text-sm">{error}</div> : null}
    </article>
  );
}
