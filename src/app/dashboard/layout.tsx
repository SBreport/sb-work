'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { FullPageSpinner } from '@/components/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!isAdmin) {
      router.replace('/notices');
    }
  }, [loading, user, isAdmin, router]);

  if (loading) return <FullPageSpinner />;
  if (!user || !isAdmin) return <FullPageSpinner />;

  return <AppShell>{children}</AppShell>;
}
