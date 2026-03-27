'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { FullPageSpinner } from './Spinner';
import { Menu } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <FullPageSpinner />;
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
