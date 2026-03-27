'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { FullPageSpinner } from './Spinner';
import { Menu } from 'lucide-react';

// 초기값을 클라이언트에서 즉시 결정 (useEffect 전 깜빡임 방지)
function getInitialMedia() {
  if (typeof window === 'undefined') return { mobile: false, open: true };
  const isDesktop = window.matchMedia('(min-width: 768px)').matches;
  return { mobile: !isDesktop, open: isDesktop };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const initial = getInitialMedia();
  const [sidebarOpen, setSidebarOpen] = useState(initial.open);
  const [isMobile, setIsMobile] = useState(initial.mobile);

  // 화면 크기 변경 감지
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
      setSidebarOpen(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (loading) {
    return <FullPageSpinner />;
  }

  if (!user) return null;

  return (
    <div className="flex h-screen">
      {/* ── 모바일: 오버레이 사이드바 ── */}
      {isMobile && (
        <>
          {/* 어두운 배경 */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-40 transition-opacity"
              onClick={closeSidebar}
            />
          )}
          {/* 슬라이드 사이드바 */}
          <div
            className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar onClose={closeSidebar} />
          </div>
        </>
      )}

      {/* ── PC: push 방식 사이드바 ── */}
      {!isMobile && (
        <div
          className={`shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            sidebarOpen ? 'w-64' : 'w-0'
          }`}
        >
          <div className="w-64 h-full">
            <Sidebar onClose={closeSidebar} />
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* 햄버거 버튼 — 사이드바 닫혀있을 때만 */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-30 p-2 bg-white rounded-lg shadow-md hover:shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 transition-all"
          >
            <Menu size={20} />
          </button>
        )}

        <main className={`flex-1 overflow-auto ${isMobile && !sidebarOpen ? 'pt-14' : ''} ${!isMobile && !sidebarOpen ? 'pl-16' : ''} transition-all duration-300`}>
          {children}
        </main>
      </div>
    </div>
  );
}
