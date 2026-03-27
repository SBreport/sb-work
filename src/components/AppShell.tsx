'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && profile?.must_change_password && profile?.role !== 'admin' && profile?.role !== 'editor') {
      const skipCount = profile?.password_skip_count || 0;
      if (skipCount >= 3) {
        router.push('/force-change-password');
      } else if (typeof window !== 'undefined' && !sessionStorage.getItem('pw_skip_done') && !sessionStorage.getItem('pw_skip_shown')) {
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
      {/* 사이드바 — 레이아웃을 밀어내는 방식 */}
      <div
        className={`shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className="w-64 h-full">
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

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

        <main className={`flex-1 overflow-auto ${!sidebarOpen ? 'pl-16' : ''} transition-all duration-300`}>
          {children}
        </main>
      </div>
    </div>
  );
}
