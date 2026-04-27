'use client';

import { UserCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ClientsPage() {
  const { profile, loading: authLoading } = useAuth();

  if (authLoading || !profile) {
    return <div className="p-8 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-6">클라이언트</h2>
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <UserCircle size={48} strokeWidth={1.5} />
        <p className="mt-4 text-base font-medium">준비중</p>
      </div>
    </div>
  );
}
