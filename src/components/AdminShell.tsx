'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import type { AdminRole } from '@/lib/types';

type NavItem = {
  href: string;
  label: string;
  roles: AdminRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['superadmin', 'editor', 'operator'] },
  { href: '/content/news', label: 'News', roles: ['superadmin', 'editor'] },
  { href: '/content/pages', label: 'Pages', roles: ['superadmin', 'editor'] },
  { href: '/media/files', label: 'Files', roles: ['superadmin', 'editor'] },
  { href: '/operations/sync', label: 'Sync Ops', roles: ['superadmin', 'operator'] },
  { href: '/operations/live', label: 'Live Ops', roles: ['superadmin', 'operator'] },
  { href: '/users', label: 'Users', roles: ['superadmin'] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = NAV_ITEMS.filter((item) => (user ? item.roles.includes(user.role) : false));

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-4 md:grid-cols-[240px_1fr]">
        <aside className="card h-fit md:sticky md:top-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.22em] text-admin-muted">QFL</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-2xl font-semibold">Admin</h1>
          </div>

          <nav className="space-y-1">
            {links.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-admin-accent text-[#0b1220]'
                      : 'text-admin-muted hover:bg-[#192640] hover:text-admin-text'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-lg border border-admin-line bg-[#0E172A] p-3 text-xs text-admin-muted">
            <p className="truncate text-admin-text">{user?.email}</p>
            <p className="mt-1">Role: {user?.role}</p>
            <button type="button" onClick={() => void logout()} className="btn btn-danger mt-3 w-full">
              Logout
            </button>
          </div>
        </aside>

        <main className="space-y-4">{children}</main>
      </div>
    </div>
  );
}
