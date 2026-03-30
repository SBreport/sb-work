'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Pin } from 'lucide-react';

interface Notice {
  id: string;
  title: string;
  content: string;
  month: string | null;
  is_pinned: boolean;
  is_active: boolean;
  created_at: string;
}

export default function PublicNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  return (
    <div className="p-4 max-w-[900px] mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-4">공지사항</h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">등록된 공지가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-lg border p-4 ${
                n.is_pinned ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {n.is_pinned && <Pin size={12} className="text-blue-500 shrink-0" />}
                <h4 className="text-sm font-semibold text-gray-900">{n.title}</h4>
                {n.month && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded shrink-0">
                    {n.month.replace('-', '.')}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 whitespace-pre-line">{n.content}</p>
              <p className="text-[10px] text-gray-400 mt-2">
                {new Date(n.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
