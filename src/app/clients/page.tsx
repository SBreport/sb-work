'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface BranchItem {
  id: string;
  name: string;
  category: string;
  product_type: string;
  status: 'active' | 'terminated';
  assignments: {
    main_writer_name: string | null;
    main_quantity: number;
    sub_writer_name: string | null;
    sub_quantity: number;
    renewal_day: number;
    status: string;
  }[];
}

export default function ClientsPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('전체');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/branches?month=${month}`);
      const data = await res.json();
      setBranches((data.branches || []).filter((b: BranchItem) => b.status === 'active'));
    } catch {
      setBranches([]);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [y, m] = month.split('-').map(Number);
  const prevMonth = () => {
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const typeSet = new Set(branches.map(b => (b.product_type || '').trim()).filter(Boolean));
  const typeOrder = ['유앤아이', '로컬', '솔루션', '대행'];
  const tabs = ['전체', ...typeOrder.filter(t => typeSet.has(t)), ...Array.from(typeSet).filter(t => !typeOrder.includes(t)).sort()];

  let filtered = activeTab === '전체' ? branches : branches.filter(b => (b.product_type || '').trim() === activeTab);
  if (search) filtered = filtered.filter(b => b.name.includes(search) || b.category?.includes(search));

  return (
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">클라이언트</h2>
          <p className="text-xs text-gray-500 mt-0.5">활성 지점 {branches.length}개</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
          <span className="text-sm font-bold text-gray-900 min-w-[100px] text-center">{y}년 {m}월</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="flex gap-1 flex-wrap flex-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {tab} <span className="ml-0.5 opacity-70">{tab === '전체' ? branches.length : branches.filter(b => (b.product_type || '').trim() === tab).length}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색" className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-36" />
        </div>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs">지점명</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">과목</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">유형</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs">갱신일</th>
                <th className="px-3 py-2.5 text-center font-medium text-blue-600 text-xs">사수</th>
                <th className="px-3 py-2.5 text-center font-medium text-green-600 text-xs">부사수</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">해당하는 지점이 없습니다.</td></tr>
              ) : filtered.map((b, idx) => {
                const a = b.assignments[0];
                return (
                  <tr key={b.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{b.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[11px]">{b.category}</span>
                    </td>
                    <td className="px-3 py-2">
                      {b.product_type ? (
                        <span className="inline-block px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[11px]">{b.product_type}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">
                      {a?.renewal_day ? `${a.renewal_day}일` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {a?.main_writer_name ? (
                        <span className="text-gray-700">{a.main_writer_name} <span className="font-bold text-blue-600">{a.main_quantity}</span></span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {a?.sub_writer_name ? (
                        <span className="text-gray-700">{a.sub_writer_name} <span className="font-bold text-green-600">{a.sub_quantity}</span></span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
