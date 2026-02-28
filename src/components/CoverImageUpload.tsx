'use client';

import { useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';

type CoverImageUploadProps = {
  currentUrl: string;
  onUpload: (objectName: string, url: string) => void;
  onRemove: () => void;
};

export default function CoverImageUpload({ currentUrl, onUpload, onRemove }: CoverImageUploadProps) {
  const { authFetch } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await authFetch('/files/upload?category=news_image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || 'Upload failed');
      }

      const data = await response.json();
      onUpload(data.object_name, data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.18em] text-admin-muted">Обложка</label>

      {currentUrl ? (
        <div className="relative inline-block">
          <img
            src={currentUrl}
            alt="Cover"
            className="max-h-48 rounded-lg border border-admin-line object-cover"
          />
          <button
            type="button"
            className="absolute right-1 top-1 rounded bg-black/70 px-2 py-0.5 text-xs text-red-300 hover:bg-black/90"
            onClick={() => {
              onRemove();
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            Удалить
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="field text-xs file:mr-2 file:rounded file:border-0 file:bg-admin-accent/20 file:px-2 file:py-1 file:text-xs file:text-admin-accent"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
          disabled={uploading}
        />
        {uploading && <span className="text-xs text-admin-muted">Загрузка...</span>}
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
