'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    // 비밀번호 변경 필요 여부 체크 (admin/editor 제외)
    if (profile?.must_change_password && profile?.role !== 'admin' && profile?.role !== 'editor') {
      const skipCount = profile?.password_skip_count || 0;
      const skipDone = typeof window !== 'undefined' && sessionStorage.getItem('pw_skip_done');

      // 3회 초과 건너뛰기: 강제 변경
      // 아직 스킵하지 않은 경우: 안내 표시
      if (skipCount >= 3 || !skipDone) {
        router.push('/force-change-password');
        return;
      }
    }

    // 역할별 홈 라우팅
    if (profile?.role === 'admin' || profile?.role === 'editor') {
      router.push('/admin/dashboard');
    } else if (profile?.role === 'employee') {
      // 직원: 배정된 업무가 있으면 /my, 없으면 /notices
      supabase
        .from('assignments')
        .select('id')
        .or(`main_writer_id.eq.${profile.id},sub_writer_id.eq.${profile.id},optimal_writer_id.eq.${profile.id},inbl_writer_id.eq.${profile.id}`)
        .limit(1)
        .then(({ data }) => router.push((data?.length ?? 0) > 0 ? '/my' : '/notices'));
    } else {
      router.push('/my');
    }
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
