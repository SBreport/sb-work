'use client';

import { Handshake } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function PartnersPage() {
  const { profile, viewAsRole, isViewingAs, loading: authLoading } = useAuth();

  // 실제 프리랜서 OR 관리자가 프리랜서 미리보기 모드일 때 차단
  const isFreelancerMode =
    profile?.role === 'freelancer' ||
    (isViewingAs && viewAsRole === 'freelancer');

  // 렌더링 가드 — 모든 hooks 선언 후
  if (authLoading || !profile) {
    return <div className="p-8 text-center text-gray-400">로딩 중...</div>;
  }
  if (isFreelancerMode) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">이 페이지에 접근할 수 있는 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-6">협력사</h2>
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Handshake size={48} strokeWidth={1.5} />
        <p className="mt-4 text-base font-medium">준비중</p>
      </div>
    </div>
  );
}
