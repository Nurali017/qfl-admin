'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AdminShell } from '@/components/AdminShell';
import { useAuth } from '@/context/AuthContext';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="card text-sm text-admin-muted">Проверяем сессию...</div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
