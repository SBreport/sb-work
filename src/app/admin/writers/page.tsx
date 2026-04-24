'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { User } from '@/types/database';
import { Plus, Pencil, RefreshCw } from 'lucide-react';
import WriterEditModal from './WriterEditModal';

export default function WritersPage() {
  const { isEditor } = useAuth();
  const [writers, setWriters] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWriter, setEditingWriter] = useState<User | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newWriter, setNewWriter] = useState({ name: '', email: '', phone: '', password: '', role: 'freelancer' as 'employee' | 'freelancer' });
  const [filter, setFilter] = useState<'all' | 'employee' | 'freelancer'>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<{ matched: number; unmatched: string[] } | null>(null);

  const handleRematch = async () => {
    if (rematching) return;
    setRematching(true);
    setRematchResult(null);
    try {
      const res = await authFetch('/api/writers/rematch', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRematchResult({ matched: data.matched, unmatched: data.unmatched || [] });
      } else {
        setError(data.error || '갱신 실패');
      }
    } catch {
      setError('갱신 중 오류가 발생했습니다.');
    }
    setRematching(false);
  };

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
      setNewWriter({ name: '', email: '', phone: '', password: '', role: 'freelancer' });
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleRematch}
              disabled={rematching}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              title="배정 데이터의 미매칭 담당자를 이름 기준으로 자동 매칭합니다"
            >
              <RefreshCw size={14} className={rematching ? 'animate-spin' : ''} />
              {rematching ? '갱신 중...' : '담당자 갱신'}
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} />
              담당자 추가
            </button>
          </div>
        )}
      </div>

      {/* 갱신 결과 알림 */}
      {rematchResult && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-blue-700">{rematchResult.matched}건 매칭 완료</span>
              {rematchResult.unmatched.length > 0 && (
                <span className="ml-2 text-gray-600">
                  · 여전히 미매칭: <span className="font-medium text-orange-600">{rematchResult.unmatched.join(', ')}</span>
                </span>
              )}
              {rematchResult.matched === 0 && rematchResult.unmatched.length === 0 && (
                <span className="ml-2 text-gray-500">매칭할 항목이 없습니다.</span>
              )}
            </div>
            <button onClick={() => setRematchResult(null)} className="text-gray-400 hover:text-gray-600 text-xs">닫기</button>
          </div>
        </div>
      )}

      {/* 추가 폼 */}
      {showAdd && !isEditor && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">새 담당자 계정 생성</h3>
          <form onSubmit={handleAddWriter} className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <select
              value={newWriter.role}
              onChange={(e) => setNewWriter({ ...newWriter, role: e.target.value as 'employee' | 'freelancer' })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="freelancer">프리랜서</option>
              <option value="employee">직원</option>
            </select>
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

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-3">
        {(['all', 'employee', 'freelancer'] as const).map(f => {
          const counts = {
            all: writers.length,
            employee: writers.filter(w => w.role === 'employee').length,
            freelancer: writers.filter(w => w.role === 'freelancer').length,
          };
          const labels = { all: '전체', employee: '직원', freelancer: '프리랜서' };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {labels[f]} <span className="ml-0.5 opacity-70">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {/* 담당자 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left font-medium text-gray-600">이름</th>
              <th className="px-6 py-3 text-left font-medium text-gray-600">이메일</th>
              <th className="px-6 py-3 text-left font-medium text-gray-600">전화번호</th>
              <th className="px-6 py-3 text-center font-medium text-gray-600">소속</th>
              <th className="px-6 py-3 text-center font-medium text-gray-600">상태</th>
              <th className="px-6 py-3 text-center font-medium text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">로딩 중...</td></tr>
            ) : writers.filter(w => filter === 'all' ? true : w.role === filter).length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">등록된 담당자가 없습니다.</td></tr>
            ) : (
              writers.filter(w => filter === 'all' ? true : w.role === filter).map((w) => (
                <tr key={w.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{w.name}</td>
                  <td className="px-6 py-3 text-gray-500">{w.email}</td>
                  <td className="px-6 py-3 text-gray-500">{w.phone || '-'}</td>
                  <td className="px-6 py-3 text-center">
                    {w.role === 'admin' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">관리자</span>
                    ) : w.role === 'editor' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">편집자</span>
                    ) : w.role === 'employee' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">직원</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">프리랜서</span>
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
