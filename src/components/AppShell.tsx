'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { Menu, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);      // 모바일 오버레이
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // PC 접힘

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // 프리랜서 첫 로그인 시 비밀번호 변경 안내
    // 3회까지 건너뛰기 가능, 3회 초과 시 강제
    if (!loading && user && profile?.must_change_password && profile?.role !== 'admin' && profile?.role !== 'editor' && profile?.role !== 'employee') {
      const skipCount = profile?.password_skip_count || 0;
      if (skipCount >= 3) {
        // 3회 이상 건너뛰었으면 강제
        router.push('/force-change-password');
      } else if (typeof window !== 'undefined' && !sessionStorage.getItem('pw_skip_done') && !sessionStorage.getItem('pw_skip_shown')) {
        // 이번 세션에서 스킵하지 않았고, 안내를 아직 안 보여줬으면 표시
        sessionStorage.setItem('pw_skip_shown', 'true');
        router.push('/force-change-password');
      }
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바: 데스크톱 접힘/열림, 모바일 오버레이 토글 */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'md:hidden' : ''}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} onCollapse={() => setSidebarCollapsed(true)} />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더: 모바일 항상 표시 / PC는 접힌 상태에서만 표시 */}
        <header className={`flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white ${sidebarCollapsed ? '' : 'md:hidden'}`}>
          <button
            onClick={() => { if (sidebarCollapsed) setSidebarCollapsed(false); else setSidebarOpen(true); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            {sidebarCollapsed ? <ChevronsRight size={22} /> : <Menu size={22} />}
          </button>
          <h1 className="text-base font-bold text-gray-900">스마트브랜딩</h1>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
