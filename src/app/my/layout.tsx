'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AppShell from '@/components/AppShell';

export default function FreelancerLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin, isViewingAs, viewAsRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 관리자가 미리보기 모드가 아닌 상태로 /freelancer 접근 시 → 관리자 대시보드로
    if (!loading && profile && isAdmin && !(isViewingAs && (viewAsRole === 'freelancer' || viewAsRole === 'employee'))) {
      router.replace('/admin/dashboard');
    }
  }, [loading, profile, isAdmin, isViewingAs, viewAsRole, router]);

  return <AppShell>{children}</AppShell>;
}
