'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Branch } from '@/types/database';
import { Plus, Trash2 } from 'lucide-react';

const CATEGORIES = ['피부과', '내과', '산부인과', '한의원', '성형외과', '정형외과', '치과', '안과', '기타'];

export default function BranchesPage() {
  const { isEditor } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('전체');

  // 지점 추가 폼
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', category: '피부과', product_type: '' });

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('branches').select('*').order('name');
    setBranches(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('branches').insert(newBranch);
    setNewBranch({ name: '', category: '피부과', product_type: '' });
    setShowAddBranch(false);
    fetchData();
  };

  const toggleBranchStatus = async (branch: Branch) => {
    const newStatus = branch.status === 'active' ? 'terminated' : 'active';
    await supabase.from('branches').update({ status: newStatus }).eq('id', branch.id);
    fetchData();
  };

  const deleteBranch = async (id: string) => {
    if (!confirm('이 지점을 삭제하시겠습니까?')) return;
    await supabase.from('branches').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">지점 관리</h2>
        {!isEditor && (
          <button
            onClick={() => setShowAddBranch(!showAddBranch)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            지점 추가
          </button>
        )}
      </div>

      {/* 지점 추가 폼 */}
      {showAddBranch && !isEditor && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">새 지점 등록</h3>
          <form onSubmit={handleAddBranch} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">지점명</label>
              <input
                type="text"
                placeholder="예: 유앤아이 광명"
                value={newBranch.name}
                onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div className="w-40">
              <label className="block text-xs text-gray-500 mb-1">과목</label>
              <select
                value={newBranch.category}
                onChange={(e) => setNewBranch({ ...newBranch, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs text-gray-500 mb-1">상품 유형</label>
              <input
                type="text"
                placeholder="예: 솔루션, 로컬"
                value={newBranch.product_type}
                onChange={(e) => setNewBranch({ ...newBranch, product_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              등록
            </button>
          </form>
        </div>
      )}

      {/* 유형별 서브탭 */}
      {(() => {
        const typeSet = new Set(branches.map(b => (b.product_type || '').replace(/,/g, '').trim()).filter(Boolean));
        const typeOrder = ['유앤아이', '로컬', '솔루션'];
        const orderedTypes = typeOrder.filter(t => typeSet.has(t));
        const remaining = Array.from(typeSet).filter(t => !typeOrder.includes(t)).sort();
        const tabs = ['전체', ...orderedTypes, ...remaining];
        const filteredBranches = activeTab === '전체' ? branches : branches.filter(b => (b.product_type || '').replace(/,/g, '').trim() === activeTab);

        return loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="flex gap-1 mb-3 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                  <span className="ml-1 opacity-70">
                    {tab === '전체' ? branches.length : branches.filter(b => (b.product_type || '').replace(/,/g, '').trim() === tab).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-medium text-gray-600">지점명</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-600">과목</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-600">상품 유형</th>
                    <th className="px-6 py-3 text-center font-medium text-gray-600">상태</th>
                    {!isEditor && <th className="px-6 py-3 text-center font-medium text-gray-600">관리</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredBranches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                        등록된 지점이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredBranches.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{b.name}</td>
                    <td className="px-6 py-3">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {b.category?.replace(/,/g, '')}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {b.product_type ? (
                        <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                          {b.product_type?.replace(/,/g, '')}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {isEditor ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          b.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {b.status === 'active' ? '활성' : '해지'}
                        </span>
                      ) : (
                        <button
                          onClick={() => toggleBranchStatus(b)}
                          className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                            b.status === 'active'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {b.status === 'active' ? '활성' : '해지'}
                        </button>
                      )}
                    </td>
                    {!isEditor && (
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => deleteBranch(b.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="지점 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </>
        );
      })()}
    </div>
  );
}
