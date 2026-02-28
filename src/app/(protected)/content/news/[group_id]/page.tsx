'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import CoverImageUpload from '@/components/CoverImageUpload';
import { useAuth } from '@/context/AuthContext';
import { parseJsonOrThrow } from '@/lib/http';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

type TeamOption = { id: number; name: string };
type GameOption = { id: number; date: string; home_team: { name: string } | null; away_team: { name: string } | null };

type NewsArticleType = 'NEWS' | 'ANALYTICS' | null;

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
  team_ids?: number[];
  game_ids?: number[];
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

export default function NewsEditPage() {
  const { group_id } = useParams<{ group_id: string }>();
  const router = useRouter();
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [material, setMaterial] = useState<NewsMaterial | null>(null);

  // Links state
  const [linkedTeamIds, setLinkedTeamIds] = useState<number[]>([]);
  const [linkedGameIds, setLinkedGameIds] = useState<number[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [gameSearchDate, setGameSearchDate] = useState('');
  const [gameResults, setGameResults] = useState<GameOption[]>([]);
  const [gamesSearching, setGamesSearching] = useState(false);
  const [linksSaving, setLinksSaving] = useState(false);

  // Common fields (applied to both RU and KZ on save)
  const [articleType, setArticleType] = useState<NewsArticleType>(null);
  const [championshipCode, setChampionshipCode] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isSlider, setIsSlider] = useState(false);
  const [sliderOrder, setSliderOrder] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  // RU fields
  const [ruTitle, setRuTitle] = useState('');
  const [ruExcerpt, setRuExcerpt] = useState('');
  const [ruContent, setRuContent] = useState('');
  const [ruContentText, setRuContentText] = useState('');

  // KZ fields
  const [kzTitle, setKzTitle] = useState('');
  const [kzExcerpt, setKzExcerpt] = useState('');
  const [kzContent, setKzContent] = useState('');
  const [kzContentText, setKzContentText] = useState('');

  const loadMaterial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matRes, teamsRes] = await Promise.all([
        authFetch(`/news/materials/${group_id}`),
        authFetch(`/teams?lang=ru`),
      ]);
      const data: NewsMaterial = await parseJsonOrThrow(matRes);
      const teamsData: { items: TeamOption[] } = await parseJsonOrThrow(teamsRes);
      setMaterial(data);
      setLinkedTeamIds(data.team_ids ?? []);
      setLinkedGameIds(data.game_ids ?? []);
      setAllTeams(teamsData.items ?? []);

      // Use RU as source of truth for common fields, fall back to KZ
      const common = data.ru ?? data.kz;
      setArticleType(normalizeArticleType(common?.article_type ?? null));
      setChampionshipCode(common?.championship_code ?? '');
      setPublishDate(common?.publish_date ? String(common.publish_date).slice(0, 10) : '');
      setVideoUrl(common?.video_url ?? '');
      setIsSlider(common?.is_slider ?? false);
      setSliderOrder(common?.slider_order != null ? String(common.slider_order) : '');
      setImageUrl(common?.image_url ?? '');
      setImagePreviewUrl(common?.image_url ?? '');

      setRuTitle(data.ru?.title ?? '');
      setRuExcerpt(data.ru?.excerpt ?? '');
      setRuContent(data.ru?.content ?? '');
      setRuContentText(data.ru?.content_text ?? '');

      setKzTitle(data.kz?.title ?? '');
      setKzExcerpt(data.kz?.excerpt ?? '');
      setKzContent(data.kz?.content ?? '');
      setKzContentText(data.kz?.content_text ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить материал');
    } finally {
      setLoading(false);
    }
  }, [authFetch, group_id]);

  useEffect(() => {
    void loadMaterial();
  }, [loadMaterial]);

  const handleSearchGames = useCallback(async () => {
    if (!gameSearchDate) return;
    setGamesSearching(true);
    try {
      const res = await authFetch(`/games?lang=ru&date_from=${gameSearchDate}&date_to=${gameSearchDate}&limit=50`);
      const data: { items: GameOption[] } = await parseJsonOrThrow(res);
      setGameResults(data.items ?? []);
    } catch {
      setGameResults([]);
    } finally {
      setGamesSearching(false);
    }
  }, [authFetch, gameSearchDate]);

  const handleSaveLinks = async () => {
    setLinksSaving(true);
    setError(null);
    try {
      await authFetch(`/news/materials/${group_id}/links`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_ids: linkedTeamIds, game_ids: linkedGameIds }),
      });
      setSaveMsg('Привязки сохранены!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения привязок');
    } finally {
      setLinksSaving(false);
    }
  };

  // Common fields are explicitly sent (even if null) so the backend applies them to both languages
  const buildCommonPayload = () => ({
    article_type: articleType,
    championship_code: championshipCode || null,
    publish_date: publishDate || null,
    video_url: videoUrl || null,
    is_slider: isSlider,
    slider_order: sliderOrder ? Number(sliderOrder) : null,
    image_url: imageUrl || null,
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      const common = buildCommonPayload();
      const body: Record<string, unknown> = {};

      if (material?.ru) {
        body.ru = {
          title: ruTitle,
          excerpt: ruExcerpt || null,
          content: ruContent || null,
          content_text: ruContentText || null,
          ...common,
        };
      }
      if (material?.kz) {
        body.kz = {
          title: kzTitle,
          excerpt: kzExcerpt || null,
          content: kzContent || null,
          content_text: kzContentText || null,
          ...common,
        };
      }

      const res = await authFetch(`/news/materials/${group_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await parseJsonOrThrow(res);
      setSaveMsg('Сохранено!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить материал полностью (RU+KZ)?')) return;
    setSaving(true);
    try {
      const res = await authFetch(`/news/materials/${group_id}`, { method: 'DELETE' });
      await parseJsonOrThrow(res);
      router.push('/content/news');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-admin-muted">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/content/news" className="text-sm text-admin-muted hover:text-white transition-colors">
              ← Все материалы
            </Link>
            <h1 className="font-[var(--font-heading)] text-2xl mt-1">Редактирование материала</h1>
            <p className="text-xs text-admin-muted mt-0.5 font-mono">{group_id}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => void handleDelete()}
              disabled={saving}
            >
              Удалить
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="card border-admin-danger text-sm text-red-100">{error}</section>
      )}
      {saveMsg && (
        <section className="card border-green-700 bg-green-900/20 text-sm text-green-300">
          {saveMsg}
        </section>
      )}

      {/* Common settings — applied to BOTH RU and KZ on save */}
      <section className="card space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">
          Общие настройки (применяются к RU и KZ)
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-admin-muted">Тип статьи</label>
            <select
              className="field"
              value={articleType ?? ''}
              onChange={(e) => setArticleType(normalizeArticleType(e.target.value || null))}
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
              value={championshipCode}
              onChange={(e) => setChampionshipCode(e.target.value)}
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
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-admin-muted">Video URL</label>
            <input
              className="field"
              placeholder="https://youtube.com/..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-admin-muted self-end py-2">
            <input
              type="checkbox"
              checked={isSlider}
              onChange={(e) => setIsSlider(e.target.checked)}
            />
            Слайдер
          </label>
          {isSlider && (
            <div className="space-y-1">
              <label className="text-xs text-admin-muted">Порядок в слайдере</label>
              <input
                type="number"
                className="field"
                placeholder="1"
                value={sliderOrder}
                onChange={(e) => setSliderOrder(e.target.value)}
              />
            </div>
          )}
        </div>
      </section>

      {/* Cover image */}
      <section className="card">
        <CoverImageUpload
          currentUrl={imagePreviewUrl}
          onUpload={(objectName, url) => {
            setImageUrl(objectName);
            setImagePreviewUrl(url);
          }}
          onRemove={() => {
            setImageUrl('');
            setImagePreviewUrl('');
          }}
        />
      </section>

      {/* Links section */}
      <section className="card space-y-4">
        <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">
          Привязки (команды и матчи)
        </p>

        {/* Teams */}
        <div className="space-y-2">
          <label className="text-xs text-admin-muted">Команды</label>
          <input
            className="field"
            placeholder="Поиск команды..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-36 overflow-y-auto">
            {allTeams
              .filter((t) => !teamSearch || t.name.toLowerCase().includes(teamSearch.toLowerCase()))
              .map((team) => {
                const checked = linkedTeamIds.includes(team.id);
                return (
                  <label key={team.id} className="flex items-center gap-1.5 text-sm cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setLinkedTeamIds((prev) =>
                          checked ? prev.filter((id) => id !== team.id) : [...prev, team.id]
                        )
                      }
                    />
                    <span className={checked ? 'text-white font-medium' : 'text-admin-muted'}>
                      {team.name}
                    </span>
                  </label>
                );
              })}
          </div>
          {linkedTeamIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {linkedTeamIds.map((id) => {
                const team = allTeams.find((t) => t.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-admin-card border border-admin-border rounded px-2 py-0.5 text-xs text-white">
                    {team?.name ?? `#${id}`}
                    <button
                      type="button"
                      className="text-admin-muted hover:text-white"
                      onClick={() => setLinkedTeamIds((prev) => prev.filter((x) => x !== id))}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Games */}
        <div className="space-y-2">
          <label className="text-xs text-admin-muted">Матч (поиск по дате)</label>
          <div className="flex gap-2">
            <input
              type="date"
              className="field flex-1"
              value={gameSearchDate}
              onChange={(e) => setGameSearchDate(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleSearchGames()}
              disabled={gamesSearching || !gameSearchDate}
            >
              {gamesSearching ? 'Поиск...' : 'Найти'}
            </button>
          </div>
          {gameResults.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {gameResults.map((game) => {
                const alreadyLinked = linkedGameIds.includes(game.id);
                const label = `${game.home_team?.name ?? '?'} vs ${game.away_team?.name ?? '?'} (${game.date})`;
                return (
                  <div key={game.id} className="flex items-center justify-between text-sm py-1 border-b border-admin-border">
                    <span className={alreadyLinked ? 'text-white' : 'text-admin-muted'}>{label}</span>
                    <button
                      type="button"
                      className={`text-xs px-2 py-0.5 rounded ${alreadyLinked ? 'text-red-400 hover:text-red-300' : 'text-blue-400 hover:text-blue-300'}`}
                      onClick={() =>
                        setLinkedGameIds((prev) =>
                          alreadyLinked ? prev.filter((id) => id !== game.id) : [...prev, game.id]
                        )
                      }
                    >
                      {alreadyLinked ? 'Убрать' : 'Добавить'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {linkedGameIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {linkedGameIds.map((id) => {
                const game = gameResults.find((g) => g.id === id);
                const label = game
                  ? `${game.home_team?.name ?? '?'} vs ${game.away_team?.name ?? '?'} (${game.date})`
                  : `Game #${id}`;
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-admin-card border border-admin-border rounded px-2 py-0.5 text-xs text-white">
                    {label}
                    <button
                      type="button"
                      className="text-admin-muted hover:text-white"
                      onClick={() => setLinkedGameIds((prev) => prev.filter((x) => x !== id))}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSaveLinks()}
            disabled={linksSaving}
          >
            {linksSaving ? 'Сохраняем...' : 'Сохранить привязки'}
          </button>
        </div>
      </section>

      {/* RU / KZ translation editors */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* RU */}
        <div className="card space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">RU</p>
          {material?.ru ? (
            <>
              <input
                className="field"
                placeholder="Заголовок RU"
                value={ruTitle}
                onChange={(e) => setRuTitle(e.target.value)}
              />
              <textarea
                className="field min-h-16"
                placeholder="Анонс / excerpt RU"
                value={ruExcerpt}
                onChange={(e) => setRuExcerpt(e.target.value)}
                rows={2}
              />
              <label className="text-xs text-admin-muted">Контент RU</label>
              <RichTextEditor
                value={ruContent}
                onChange={(html, text) => {
                  setRuContent(html);
                  setRuContentText(text);
                }}
                placeholder="Контент RU..."
              />
            </>
          ) : (
            <p className="text-sm text-admin-muted">RU перевод отсутствует</p>
          )}
        </div>

        {/* KZ */}
        <div className="card space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-admin-muted">KZ</p>
          {material?.kz ? (
            <>
              <input
                className="field"
                placeholder="Заголовок KZ"
                value={kzTitle}
                onChange={(e) => setKzTitle(e.target.value)}
              />
              <textarea
                className="field min-h-16"
                placeholder="Анонс / excerpt KZ"
                value={kzExcerpt}
                onChange={(e) => setKzExcerpt(e.target.value)}
                rows={2}
              />
              <label className="text-xs text-admin-muted">Контент KZ</label>
              <RichTextEditor
                value={kzContent}
                onChange={(html, text) => {
                  setKzContent(html);
                  setKzContentText(text);
                }}
                placeholder="Контент KZ..."
              />
            </>
          ) : (
            <p className="text-sm text-admin-muted">KZ перевод отсутствует</p>
          )}
        </div>
      </div>

      {/* Bottom save */}
      <section className="card flex justify-end gap-2">
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => void handleDelete()}
          disabled={saving}
        >
          Удалить
        </button>
      </section>
    </div>
  );
}
