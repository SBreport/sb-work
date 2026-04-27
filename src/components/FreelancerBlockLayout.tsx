'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AppShell from './AppShell';
import { FullPageSpinner } from './Spinner';

export default function FreelancerBlockLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, viewAsRole, isViewingAs } = useAuth();
  const router = useRouter();

  // 실제 프리랜서 OR 관리자가 프리랜서 미리보기 모드일 때 차단
  const isFreelancerMode =
    profile?.role === 'freelancer' ||
    (isViewingAs && viewAsRole === 'freelancer');

  useEffect(() => {
    if (!loading && profile && isFreelancerMode) {
      router.replace('/my');
    }
  }, [loading, profile, isFreelancerMode, router]);

  if (loading) return <FullPageSpinner />;
  if (!user) return null;
  if (!profile) return <FullPageSpinner />;  // 프로필 로드 전 깜박임 방지
  if (isFreelancerMode) return <FullPageSpinner />;

  return <AppShell>{children}</AppShell>;
}
