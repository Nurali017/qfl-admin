'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type NewsTranslation = {
  id: number;
  language: 'ru' | 'kz';
  title: string;
  excerpt?: string | null;
  content?: string | null;
};

type NewsMaterial = {
  group_id: string;
  ru: NewsTranslation | null;
  kz: NewsTranslation | null;
  updated_at?: string | null;
};

export default function NewsMaterialsPage() {
  const { authFetch } = useAuth();
  const [materials, setMaterials] = useState<NewsMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createRuTitle, setCreateRuTitle] = useState('');
  const [createRuContent, setCreateRuContent] = useState('');
  const [createKzTitle, setCreateKzTitle] = useState('');
  const [createKzContent, setCreateKzContent] = useState('');

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/news/materials?page=1&per_page=100');
      const data = (await parseJsonOrThrow(response)) as { items: NewsMaterial[] };
      setMaterials(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

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
          ru: { title: createRuTitle, content: createRuContent, is_slider: false },
          kz: { title: createKzTitle, content: createKzContent, is_slider: false },
        }),
      });
      await parseJsonOrThrow(response);

      setCreateRuTitle('');
      setCreateRuContent('');
      setCreateKzTitle('');
      setCreateKzContent('');
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
    payload: { title: string; content: string; excerpt?: string }
  ) => {
    const response = await authFetch(`/news/materials/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [lang]: {
          title: payload.title,
          content: payload.content,
          excerpt: payload.excerpt,
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
    payload: { title: string; content: string }
  ) => {
    const response = await authFetch(`/news/materials/${groupId}/translation/${lang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          title: payload.title,
          content: payload.content,
          is_slider: false,
        },
      }),
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
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">News Materials RU + KZ</h1>
        <p className="mt-1 text-sm text-admin-muted">Создание и редактирование двуязычных материалов.</p>
      </section>

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">Создать материал</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={createMaterial}>
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

      <section className="space-y-3">
        {loading ? <div className="card text-sm text-admin-muted">Загружаем...</div> : null}
        {!loading && materials.length === 0 ? <div className="card text-sm text-admin-muted">Материалов пока нет.</div> : null}

        {materials.map((material) => (
          <NewsMaterialCard
            key={material.group_id}
            material={material}
            onUpdate={updateTranslation}
            onAddTranslation={addMissingTranslation}
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
  onDelete,
}: {
  material: NewsMaterial;
  onUpdate: (groupId: string, lang: 'ru' | 'kz', payload: { title: string; content: string; excerpt?: string }) => Promise<void>;
  onAddTranslation: (groupId: string, lang: 'ru' | 'kz', payload: { title: string; content: string }) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
}) {
  const [ruTitle, setRuTitle] = useState(material.ru?.title || '');
  const [ruContent, setRuContent] = useState(material.ru?.content || '');
  const [kzTitle, setKzTitle] = useState(material.kz?.title || '');
  const [kzContent, setKzContent] = useState(material.kz?.content || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitUpdate = async (lang: 'ru' | 'kz') => {
    setBusy(true);
    setError(null);
    try {
      if (lang === 'ru') {
        await onUpdate(material.group_id, 'ru', { title: ruTitle, content: ruContent });
      } else {
        await onUpdate(material.group_id, 'kz', { title: kzTitle, content: kzContent });
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
        await onAddTranslation(material.group_id, 'ru', { title: ruTitle, content: ruContent });
      } else {
        await onAddTranslation(material.group_id, 'kz', { title: kzTitle, content: kzContent });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления перевода');
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
        <button type="button" className="btn btn-danger" onClick={() => void submitDelete()} disabled={busy}>
          Delete
        </button>
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
