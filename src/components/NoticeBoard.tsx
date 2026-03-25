'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone, Pin, ChevronDown, ChevronUp } from 'lucide-react';

interface Notice {
  id: string;
  title: string;
  content: string;
  month: string | null;
  is_pinned: boolean;
  created_at: string;
}

interface Props {
  month: string;
}

export default function NoticeBoard({ month }: Props) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotices = async () => {
      // 현재 월 + 다음 달 + 상시 공지 모두 표시
      const [y, m] = month.split('-').map(Number);
      const nextDate = new Date(y, m, 1); // m is already 1-based, so m = next month
      const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('is_active', true)
        .or(`month.eq.${month},month.eq.${nextMonth},month.is.null`)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('notices fetch error:', error);
      }
      setNotices(data || []);
      // 최신 공지 자동 펼침
      if (data && data.length > 0) {
        setExpandedId(data[0].id);
      }
    };
    fetchNotices();
  }, [month]);

  if (notices.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-3 overflow-hidden">
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
        <Megaphone size={14} className="text-blue-600" />
        <span className="text-xs font-semibold text-blue-700">공지사항</span>
        <span className="text-xs text-blue-400">{notices.length}건</span>
      </div>
      <div className="divide-y divide-gray-100">
        {notices.map(n => {
          const isExpanded = expandedId === n.id;
          const isNew = Date.now() - new Date(n.created_at).getTime() < 3 * 24 * 60 * 60 * 1000; // 3일 이내
          return (
            <div key={n.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : n.id)}>
              <div className="px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50/50">
                {n.is_pinned && <Pin size={11} className="text-blue-400 shrink-0" />}
                <span className="text-sm text-gray-900 font-medium flex-1 truncate">{n.title}</span>
                {isNew && <span className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded-full font-bold shrink-0">NEW</span>}
                {n.month && <span className="text-[10px] text-gray-400 shrink-0">{n.month.replace('-', '.')}</span>}
                <span className="text-[10px] text-gray-300 shrink-0">
                  {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
                {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
              {isExpanded && (
                <div className="px-4 pb-3 pt-1">
                  <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{n.content}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
