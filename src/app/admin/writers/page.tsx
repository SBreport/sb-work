'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { User } from '@/types/database';
import { Plus, Pencil } from 'lucide-react';
import WriterEditModal from './WriterEditModal';

export default function WritersPage() {
  const { isEditor } = useAuth();
  const [writers, setWriters] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWriter, setEditingWriter] = useState<User | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newWriter, setNewWriter] = useState({ name: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchWriters = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name');
    setWriters(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchWriters(); }, []);

  const handleAddWriter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // 관리자가 프리랜서 계정 생성 (Supabase Admin API 사용을 위해 서버 API 호출)
    const res = await authFetch('/api/writers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWriter),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || '계정 생성에 실패했습니다.');
    } else {
      setNewWriter({ name: '', email: '', phone: '', password: '' });
      setShowAdd(false);
      fetchWriters();
    }
    setSaving(false);
  };

  const handleEditSave = () => {
    setEditingWriter(null);
    fetchWriters();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">담당자 관리</h2>
        {!isEditor && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            담당자 추가
          </button>
        )}
      </div>

      {/* 추가 폼 */}
      {showAdd && !isEditor && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">새 담당자 계정 생성</h3>
          <form onSubmit={handleAddWriter} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="이름"
              value={newWriter.name}
              onChange={(e) => setNewWriter({ ...newWriter, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            />
            <input
              type="email"
              placeholder="이메일"
              value={newWriter.email}
              onChange={(e) => setNewWriter({ ...newWriter, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            />
            <input
              type="text"
              placeholder="전화번호"
              value={newWriter.phone}
              onChange={(e) => setNewWriter({ ...newWriter, phone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <input
              type="text"
              placeholder="초기 비밀번호"
              value={newWriter.password}
              onChange={(e) => setNewWriter({ ...newWriter, password: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
              minLength={6}
            />
            <div className="col-span-full flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '생성 중...' : '계정 생성'}
              </button>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
          </form>
        </div>
      )}

      {/* 담당자 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left font-medium text-gray-600">이름</th>
              <th className="px-6 py-3 text-left font-medium text-gray-600">이메일</th>
              <th className="px-6 py-3 text-left font-medium text-gray-600">전화번호</th>
              <th className="px-6 py-3 text-center font-medium text-gray-600">계약형태</th>
              <th className="px-6 py-3 text-center font-medium text-gray-600">상태</th>
              <th className="px-6 py-3 text-center font-medium text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">로딩 중...</td></tr>
            ) : writers.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">등록된 담당자가 없습니다.</td></tr>
            ) : (
              writers.map((w) => (
                <tr key={w.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{w.name}</td>
                  <td className="px-6 py-3 text-gray-500">{w.email}</td>
                  <td className="px-6 py-3 text-gray-500">{w.phone || '-'}</td>
                  <td className="px-6 py-3 text-center">
                    {w.role === 'admin' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">관리자</span>
                    ) : w.role === 'editor' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">편집자</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        w.contract_type === 'business'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {w.contract_type === 'business' ? '개인사업자' : '프리랜서'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      w.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {w.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    {w.role !== 'admin' && w.role !== 'editor' && !isEditor && (
                      <button
                        onClick={() => setEditingWriter(w)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="수정"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingWriter && (
        <WriterEditModal
          writer={editingWriter}
          onClose={() => setEditingWriter(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
