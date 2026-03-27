'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AppShell from '@/components/AppShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin, isViewingAs, viewAsRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profile) return;

    // 미리보기 모드일 때 역할별 리다이렉트
    if (isAdmin && isViewingAs) {
      router.replace(viewAsRole === 'freelancer' ? '/my' : '/notices');
      return;
    }

    // 관리자가 아니면 공통 페이지로 리다이렉트
    if (!isAdmin) {
      router.replace('/notices');
    }
  }, [loading, profile, isAdmin, isViewingAs, router]);

  if (loading) return null;
  if (!isAdmin) return null;
  if (isAdmin && isViewingAs) return null;

  return <AppShell>{children}</AppShell>;
}
