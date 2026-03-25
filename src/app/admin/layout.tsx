'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AppShell from '@/components/AppShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && !isAdmin) {
      // 프리랜서가 /admin 접근 시 → 자기 페이지로 리다이렉트
      router.replace('/freelancer');
    }
  }, [loading, profile, isAdmin, router]);

  // 로딩 중이거나 프리랜서면 빈 화면 (리다이렉트 대기)
  if (!loading && profile && !isAdmin) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
