'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type PageTranslation = {
  id: number;
  language: 'ru' | 'kz';
  slug: string;
  title: string;
  content?: string | null;
};

type PageMaterial = {
  group_id: string;
  ru: PageTranslation | null;
  kz: PageTranslation | null;
  updated_at?: string | null;
};

export default function PageMaterialsPage() {
  const { authFetch } = useAuth();
  const [materials, setMaterials] = useState<PageMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ruSlug, setRuSlug] = useState('');
  const [ruTitle, setRuTitle] = useState('');
  const [ruContent, setRuContent] = useState('');
  const [kzSlug, setKzSlug] = useState('');
  const [kzTitle, setKzTitle] = useState('');
  const [kzContent, setKzContent] = useState('');

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/pages/materials?page=1&per_page=100');
      const data = (await parseJsonOrThrow(response)) as { items: PageMaterial[] };
      setMaterials(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить страницы');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const createMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await authFetch('/pages/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ru: { slug: ruSlug, title: ruTitle, content: ruContent },
          kz: { slug: kzSlug, title: kzTitle, content: kzContent },
        }),
      });
      await parseJsonOrThrow(response);

      setRuSlug('');
      setRuTitle('');
      setRuContent('');
      setKzSlug('');
      setKzTitle('');
      setKzContent('');
      await loadMaterials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать материал страницы');
    }
  };

  const updateTranslation = async (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: { slug: string; title: string; content: string }
  ) => {
    const response = await authFetch(`/pages/materials/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [lang]: payload,
      }),
    });
    await parseJsonOrThrow(response);
    await loadMaterials();
  };

  const addTranslation = async (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: { slug: string; title: string; content: string }
  ) => {
    const response = await authFetch(`/pages/materials/${groupId}/translation/${lang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload }),
    });
    await parseJsonOrThrow(response);
    await loadMaterials();
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Pages Materials RU + KZ</h1>
        <p className="mt-1 text-sm text-admin-muted">Управление переводами и legacy-страницами.</p>
      </section>

      <section className="card">
        <h2 className="font-[var(--font-heading)] text-xl">Создать материал страницы</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={createMaterial}>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">RU</p>
            <input className="field" placeholder="RU slug" value={ruSlug} onChange={(e) => setRuSlug(e.target.value)} required />
            <input className="field" placeholder="RU title" value={ruTitle} onChange={(e) => setRuTitle(e.target.value)} required />
            <textarea
              className="field min-h-24"
              placeholder="RU content"
              value={ruContent}
              onChange={(e) => setRuContent(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">KZ</p>
            <input className="field" placeholder="KZ slug" value={kzSlug} onChange={(e) => setKzSlug(e.target.value)} required />
            <input className="field" placeholder="KZ title" value={kzTitle} onChange={(e) => setKzTitle(e.target.value)} required />
            <textarea
              className="field min-h-24"
              placeholder="KZ content"
              value={kzContent}
              onChange={(e) => setKzContent(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary lg:col-span-2">
            Создать
          </button>
        </form>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      <section className="space-y-3">
        {loading ? <div className="card text-sm text-admin-muted">Загружаем...</div> : null}
        {!loading && materials.length === 0 ? <div className="card text-sm text-admin-muted">Страниц пока нет.</div> : null}

        {materials.map((material) => (
          <PageMaterialCard
            key={material.group_id}
            material={material}
            onUpdate={updateTranslation}
            onAddTranslation={addTranslation}
          />
        ))}
      </section>
    </div>
  );
}

function PageMaterialCard({
  material,
  onUpdate,
  onAddTranslation,
}: {
  material: PageMaterial;
  onUpdate: (groupId: string, lang: 'ru' | 'kz', payload: { slug: string; title: string; content: string }) => Promise<void>;
  onAddTranslation: (
    groupId: string,
    lang: 'ru' | 'kz',
    payload: { slug: string; title: string; content: string }
  ) => Promise<void>;
}) {
  const [ruSlug, setRuSlug] = useState(material.ru?.slug || '');
  const [ruTitle, setRuTitle] = useState(material.ru?.title || '');
  const [ruContent, setRuContent] = useState(material.ru?.content || '');
  const [kzSlug, setKzSlug] = useState(material.kz?.slug || '');
  const [kzTitle, setKzTitle] = useState(material.kz?.title || '');
  const [kzContent, setKzContent] = useState(material.kz?.content || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card space-y-3">
      <div className="text-xs text-admin-muted">group_id: {material.group_id}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-admin-line p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-admin-muted">RU</p>
          <input className="field" value={ruSlug} onChange={(e) => setRuSlug(e.target.value)} placeholder="RU slug" />
          <input className="field" value={ruTitle} onChange={(e) => setRuTitle(e.target.value)} placeholder="RU title" />
          <textarea className="field min-h-20" value={ruContent} onChange={(e) => setRuContent(e.target.value)} placeholder="RU content" />
          {material.ru ? (
            <button
              type="button"
              className="btn btn-muted"
              onClick={() => void run(() => onUpdate(material.group_id, 'ru', { slug: ruSlug, title: ruTitle, content: ruContent }))}
              disabled={busy || !ruSlug || !ruTitle}
            >
              Save RU
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void run(() => onAddTranslation(material.group_id, 'ru', { slug: ruSlug, title: ruTitle, content: ruContent }))}
              disabled={busy || !ruSlug || !ruTitle}
            >
              Добавить RU перевод
            </button>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-admin-line p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-admin-muted">KZ</p>
          <input className="field" value={kzSlug} onChange={(e) => setKzSlug(e.target.value)} placeholder="KZ slug" />
          <input className="field" value={kzTitle} onChange={(e) => setKzTitle(e.target.value)} placeholder="KZ title" />
          <textarea className="field min-h-20" value={kzContent} onChange={(e) => setKzContent(e.target.value)} placeholder="KZ content" />
          {material.kz ? (
            <button
              type="button"
              className="btn btn-muted"
              onClick={() => void run(() => onUpdate(material.group_id, 'kz', { slug: kzSlug, title: kzTitle, content: kzContent }))}
              disabled={busy || !kzSlug || !kzTitle}
            >
              Save KZ
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void run(() => onAddTranslation(material.group_id, 'kz', { slug: kzSlug, title: kzTitle, content: kzContent }))}
              disabled={busy || !kzSlug || !kzTitle}
            >
              Добавить KZ перевод
            </button>
          )}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-admin-danger/50 bg-admin-danger/10 p-2 text-sm">{error}</div> : null}
    </article>
  );
}
