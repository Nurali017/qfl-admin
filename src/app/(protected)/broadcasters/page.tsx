'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

type Broadcaster = {
  id: number;
  name: string;
  logo_url: string | null;
  type: string | null;
  website: string | null;
  sort_order: number;
  is_active: boolean;
};

const TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'tv', label: 'ТВ' },
  { value: 'youtube', label: 'YouTube' },
];

export default function BroadcastersPage() {
  const { authFetch, hasRole } = useAuth();
  const [broadcasters, setBroadcasters] = useState<Broadcaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create / edit form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const fetchBroadcasters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/broadcasters');
      const data = await parseJsonOrThrow(res) as { items: Broadcaster[]; total: number };
      setBroadcasters(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchBroadcasters();
  }, [fetchBroadcasters]);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormType('');
    setFormWebsite('');
    setFormSortOrder('0');
    setFormIsActive(true);
    setFormLogoUrl('');
    setFormMsg('');
  };

  const startEdit = (b: Broadcaster) => {
    setEditingId(b.id);
    setFormName(b.name);
    setFormType(b.type ?? '');
    setFormWebsite(b.website ?? '');
    setFormSortOrder(String(b.sort_order));
    setFormIsActive(b.is_active);
    setFormLogoUrl(b.logo_url ?? '');
    setFormMsg('');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/files/upload?category=broadcaster_logos', {
        method: 'POST',
        body: formData,
      });
      const data = await parseJsonOrThrow(res) as { url: string };
      setFormLogoUrl(data.url);
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const save = async () => {
    if (!formName.trim()) {
      setFormMsg('Name is required');
      return;
    }
    setBusy(true);
    setFormMsg('');
    try {
      const body = {
        name: formName.trim(),
        logo_url: formLogoUrl || null,
        type: formType || null,
        website: formWebsite || null,
        sort_order: Number(formSortOrder) || 0,
        is_active: formIsActive,
      };
      if (editingId !== null) {
        await parseJsonOrThrow(await authFetch(`/broadcasters/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }));
        setFormMsg('Saved!');
      } else {
        await parseJsonOrThrow(await authFetch('/broadcasters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }));
        setFormMsg('Created!');
        resetForm();
      }
      void fetchBroadcasters();
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteBroadcaster = async (id: number) => {
    if (!confirm('Delete this broadcaster?')) return;
    setBusy(true);
    try {
      await parseJsonOrThrow(await authFetch(`/broadcasters/${id}`, { method: 'DELETE' }));
      void fetchBroadcasters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  if (!hasRole('superadmin', 'editor')) {
    return <div className="card text-sm text-admin-muted">Access denied.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="font-[var(--font-heading)] text-2xl mb-1">Broadcasters</h1>
        <p className="text-sm text-admin-muted">Manage TV and YouTube channels shown on match cards.</p>
      </section>

      {/* Create / Edit Form */}
      <section className="card">
        <h2 className="font-[var(--font-heading)] text-lg mb-3">
          {editingId !== null ? `Edit Broadcaster #${editingId}` : 'Add Broadcaster'}
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Name *</label>
            <input
              type="text"
              className="field w-48"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Qazsport"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Type</label>
            <select className="field w-32" value={formType} onChange={(e) => setFormType(e.target.value)}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Website</label>
            <input
              type="url"
              className="field w-56"
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Sort Order</label>
            <input
              type="number"
              className="field w-20"
              value={formSortOrder}
              onChange={(e) => setFormSortOrder(e.target.value)}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-admin-muted cursor-pointer">
              <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Logo</label>
            <div className="flex items-center gap-3">
              {formLogoUrl && (
                <img src={formLogoUrl} alt="logo" className="h-10 w-auto object-contain rounded border border-admin-line p-1" />
              )}
              <label className="cursor-pointer rounded border border-admin-line px-3 py-1.5 text-xs hover:bg-admin-line/30">
                {logoUploading ? 'Uploading...' : 'Upload Logo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
              </label>
              {formLogoUrl && (
                <button className="text-xs text-red-400 hover:text-red-300" onClick={() => setFormLogoUrl('')}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button className="btn" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Create'}
          </button>
          {editingId !== null && (
            <button className="btn btn-muted" onClick={resetForm}>
              Cancel
            </button>
          )}
          {formMsg && <span className="text-sm text-admin-muted">{formMsg}</span>}
        </div>
      </section>

      {/* Broadcasters Table */}
      <section className="card">
        <h2 className="font-[var(--font-heading)] text-lg mb-3">All Broadcasters</h2>

        {error && <div className="mb-3 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="text-sm text-admin-muted">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-line text-left text-xs uppercase text-admin-muted">
                  <th className="px-2 py-2">Logo</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Website</th>
                  <th className="px-2 py-2">Sort</th>
                  <th className="px-2 py-2">Active</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {broadcasters.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-admin-muted">
                      No broadcasters yet. Create one above.
                    </td>
                  </tr>
                )}
                {broadcasters.map((b) => (
                  <tr key={b.id} className="border-b border-admin-line/50 hover:bg-[#192640]/50">
                    <td className="px-2 py-2">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt={b.name} className="h-8 w-auto object-contain" />
                      ) : (
                        <span className="text-xs text-admin-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-medium">{b.name}</td>
                    <td className="px-2 py-2 text-xs text-admin-muted">{b.type ?? '—'}</td>
                    <td className="px-2 py-2 text-xs text-admin-muted max-w-[200px] truncate">
                      {b.website ? (
                        <a href={b.website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {b.website}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs font-mono">{b.sort_order}</td>
                    <td className="px-2 py-2 text-xs">
                      {b.is_active ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-admin-muted">✗</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded bg-admin-line px-2 py-0.5 text-xs hover:bg-admin-line/70"
                          onClick={() => startEdit(b)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-300 hover:bg-red-800/60"
                          disabled={busy}
                          onClick={() => void deleteBroadcaster(b.id)}
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
