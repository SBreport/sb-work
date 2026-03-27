'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentMonth } from '@/lib/date';
import { Plus, Edit2, Trash2, Pin, Eye, EyeOff } from 'lucide-react';

interface Notice {
  id: string;
  title: string;
  content: string;
  month: string | null;
  is_pinned: boolean;
  is_active: boolean;
  created_at: string;
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [month, setMonth] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` };
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setMonth('');
    setIsPinned(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    const headers = await getAuthHeader();
    const body = { title: title.trim(), content: content.trim(), month: month || null, is_pinned: isPinned };

    if (editId) {
      await fetch('/api/notices', { method: 'PATCH', headers, body: JSON.stringify({ id: editId, ...body }) });
    } else {
      await fetch('/api/notices', { method: 'POST', headers, body: JSON.stringify(body) });
    }

    resetForm();
    fetchNotices();
  };

  const handleEdit = (n: Notice) => {
    setEditId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setMonth(n.month || '');
    setIsPinned(n.is_pinned);
    setShowForm(true);
  };

  const handleToggleActive = async (n: Notice) => {
    const headers = await getAuthHeader();
    await fetch('/api/notices', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ id: n.id, is_active: !n.is_active }),
    });
    fetchNotices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const headers = await getAuthHeader();
    await fetch(`/api/notices?id=${id}`, { method: 'DELETE', headers });
    fetchNotices();
  };

  return (
    <div className="p-4 max-w-[900px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">공지사항 관리</h2>
        <button
          onClick={() => { resetForm(); setMonth(getCurrentMonth()); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> 새 공지
        </button>
      </div>

      {/* 작성/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {editId ? '공지 수정' : '새 공지 작성'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="예: 4월 업무 변경사항 안내"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">내용</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="공지 내용을 입력하세요. 줄바꿈이 그대로 표시됩니다."
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">표시 월 (비워두면 항상 표시)</label>
                <input
                  type="month"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={e => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">상단 고정</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                {editId ? '수정' : '등록'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지 목록 */}
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
                !n.is_active ? 'border-gray-100 opacity-50' : n.is_pinned ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {n.is_pinned && <Pin size={12} className="text-blue-500 shrink-0" />}
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{n.title}</h4>
                    {n.month && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded shrink-0">
                        {n.month.replace('-', '.')}
                      </span>
                    )}
                    {!n.is_active && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded shrink-0">비활성</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-line line-clamp-2">{n.content}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggleActive(n)} className="p-1.5 rounded hover:bg-gray-100" title={n.is_active ? '비활성' : '활성'}>
                    {n.is_active ? <Eye size={14} className="text-green-500" /> : <EyeOff size={14} className="text-gray-400" />}
                  </button>
                  <button onClick={() => handleEdit(n)} className="p-1.5 rounded hover:bg-gray-100" title="수정">
                    <Edit2 size={14} className="text-gray-400" />
                  </button>
                  <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded hover:bg-gray-100" title="삭제">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
