'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type StoredFile = {
  object_name: string;
  filename?: string;
  content_type?: string;
  category?: string;
  language?: string;
  size?: number;
  url?: string;
};

export default function FilesPage() {
  const { authFetch } = useAuth();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploadCategory, setUploadCategory] = useState('uploads');
  const [uploadLanguage, setUploadLanguage] = useState('');
  const [uploadNewsId, setUploadNewsId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (categoryFilter.trim()) {
        query.set('category', categoryFilter.trim());
      }
      query.set('limit', '500');

      const response = await authFetch(`/files/list?${query.toString()}`);
      const data = (await parseJsonOrThrow(response)) as { files: StoredFile[] };
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файлы');
    } finally {
      setLoading(false);
    }
  }, [authFetch, categoryFilter]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    files.forEach((file) => {
      if (file.category) {
        values.add(file.category);
      }
    });
    return Array.from(values).sort();
  }, [files]);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadFile) {
      setError('Выберите файл для загрузки');
      return;
    }

    setError(null);
    const form = new FormData();
    form.append('file', uploadFile);

    const query = new URLSearchParams({ category: uploadCategory });
    if (uploadLanguage.trim()) {
      query.set('language', uploadLanguage.trim());
    }
    if (uploadNewsId.trim()) {
      query.set('news_id', uploadNewsId.trim());
    }

    try {
      const response = await authFetch(`/files/upload?${query.toString()}`, {
        method: 'POST',
        body: form,
      });
      await parseJsonOrThrow(response);
      setUploadFile(null);
      setUploadLanguage('');
      setUploadNewsId('');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
    }
  };

  const removeFile = async (objectName: string) => {
    const [category, ...rest] = objectName.split('/');
    const filePath = rest.join('/');
    if (!category || !filePath) {
      setError('Некорректный object_name');
      return;
    }

    if (!confirm(`Удалить файл ${objectName}?`)) {
      return;
    }

    try {
      const response = await authFetch(`/files/${category}/${filePath}`, {
        method: 'DELETE',
      });
      await parseJsonOrThrow(response);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления файла');
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl">Media Files</h1>
        <p className="mt-1 text-sm text-admin-muted">Загрузка и удаление файлов MinIO через admin API.</p>
      </section>

      <section className="card">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={upload}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              className="field"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              placeholder="category"
              required
            />
            <input
              className="field"
              value={uploadLanguage}
              onChange={(e) => setUploadLanguage(e.target.value)}
              placeholder="language (ru/kz)"
            />
            <input
              className="field"
              value={uploadNewsId}
              onChange={(e) => setUploadNewsId(e.target.value)}
              placeholder="news_id (optional)"
            />
            <input className="field" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required />
          </div>
          <button className="btn btn-primary" type="submit">
            Upload
          </button>
        </form>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field max-w-xs"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="Filter by category"
          />
          <button className="btn btn-muted" type="button" onClick={() => void loadFiles()}>
            Refresh
          </button>
          {categories.length ? <span className="text-xs text-admin-muted">Known: {categories.join(', ')}</span> : null}
        </div>
      </section>

      {error ? <section className="card border-admin-danger text-sm text-red-100">{error}</section> : null}

      <section className="card overflow-x-auto">
        {loading ? <p className="text-sm text-admin-muted">Загружаем файлы...</p> : null}
        {!loading && files.length === 0 ? <p className="text-sm text-admin-muted">Файлы не найдены.</p> : null}

        {!loading && files.length > 0 ? (
          <table className="w-full min-w-[840px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-admin-muted">
                <th>Object</th>
                <th>Filename</th>
                <th>Category</th>
                <th>Size</th>
                <th>Language</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.object_name} className="rounded-lg border border-admin-line bg-[#0E172A]">
                  <td className="px-2 py-2">{file.object_name}</td>
                  <td className="px-2 py-2">{file.filename || '-'}</td>
                  <td className="px-2 py-2">{file.category || '-'}</td>
                  <td className="px-2 py-2">{typeof file.size === 'number' ? `${Math.round(file.size / 1024)} KB` : '-'}</td>
                  <td className="px-2 py-2">{file.language || '-'}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      {file.url ? (
                        <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-muted">
                          Open
                        </a>
                      ) : null}
                      <button type="button" className="btn btn-danger" onClick={() => void removeFile(file.object_name)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
