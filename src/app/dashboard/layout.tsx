'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AppShell from '@/components/AppShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // 관리자급(admin/editor)만 접근 가능
    if (!isAdmin) {
      router.replace('/notices');
    }
  }, [loading, user, isAdmin, router]);

  if (loading || !user || !isAdmin) return null;

  return <AppShell>{children}</AppShell>;
}
