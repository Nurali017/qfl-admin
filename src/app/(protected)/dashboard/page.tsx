'use client';

import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <section className="card">
        <p className="text-xs uppercase tracking-[0.2em] text-admin-muted">Панель управления</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-semibold">Добро пожаловать</h2>
        <p className="mt-2 text-sm text-admin-muted">
          Вы вошли как <span className="text-admin-text">{user?.email}</span> с ролью{' '}
          <span className="text-admin-accent">{user?.role}</span>.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/content/news" className="card transition hover:border-admin-accent">
          <h3 className="font-[var(--font-heading)] text-lg">News Materials</h3>
          <p className="mt-2 text-sm text-admin-muted">Создание и редактирование RU/KZ материалов.</p>
        </Link>

        <Link href="/content/pages" className="card transition hover:border-admin-accent">
          <h3 className="font-[var(--font-heading)] text-lg">Pages Materials</h3>
          <p className="mt-2 text-sm text-admin-muted">Страницы контактов, документов и других разделов.</p>
        </Link>

        <Link href="/media/files" className="card transition hover:border-admin-accent">
          <h3 className="font-[var(--font-heading)] text-lg">Media Files</h3>
          <p className="mt-2 text-sm text-admin-muted">Загрузка, просмотр и удаление файлов.</p>
        </Link>

        <Link href="/operations/sync" className="card transition hover:border-admin-accent">
          <h3 className="font-[var(--font-heading)] text-lg">Sync Operations</h3>
          <p className="mt-2 text-sm text-admin-muted">Ручной запуск синхронизаций данных.</p>
        </Link>

        <Link href="/operations/live" className="card transition hover:border-admin-accent">
          <h3 className="font-[var(--font-heading)] text-lg">Live Operations</h3>
          <p className="mt-2 text-sm text-admin-muted">Live-управление матчами и событиями.</p>
        </Link>

        {user?.role === 'superadmin' ? (
          <Link href="/users" className="card transition hover:border-admin-accent">
            <h3 className="font-[var(--font-heading)] text-lg">Users</h3>
            <p className="mt-2 text-sm text-admin-muted">Управление пользователями и ролями.</p>
          </Link>
        ) : null}
      </section>
    </>
  );
}
