'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import MonthSelector from '@/components/MonthSelector';
import MonthlyTrendChart from '@/components/MonthlyTrendChart';
import BranchAlerts from '@/components/BranchAlerts';
import type { Assignment, AssignmentStatus } from '@/types/database';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getAdjacentMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

interface WriterStats {
  name: string;
  mainQty: number;
  subQty: number;
  optimalQty: number;
  inblQty: number;
  branchCount: number;
  prevTotal: number;
}

function calcWriterStats(assignments: Partial<Assignment>[]): Record<string, WriterStats> {
  return assignments.reduce<Record<string, WriterStats>>((acc, a) => {
    const addWriter = (id: string | null | undefined, nameObj: unknown, nameFallback: string | null | undefined, role: 'main' | 'sub' | 'optimal' | 'inbl', qty: number) => {
      const name = (nameObj as { name: string } | undefined)?.name || nameFallback;
      if (!name) return;
      const key = id || `name:${name}`;
      if (!acc[key]) acc[key] = { name, mainQty: 0, subQty: 0, optimalQty: 0, inblQty: 0, branchCount: 0, prevTotal: 0 };
      if (role === 'main') { acc[key].mainQty += qty; acc[key].branchCount++; }
      if (role === 'sub') acc[key].subQty += qty;
      if (role === 'optimal') acc[key].optimalQty += qty;
      if (role === 'inbl') acc[key].inblQty += qty;
    };
    addWriter(a.main_writer_id, a.main_writer, a.main_writer_name, 'main', a.main_quantity || 0);
    addWriter(a.sub_writer_id, a.sub_writer, a.sub_writer_name, 'sub', a.sub_quantity || 0);
    addWriter(a.optimal_writer_id, a.optimal_writer, a.optimal_writer_name, 'optimal', a.optimal_quantity || 0);
    addWriter(a.inbl_writer_id, a.inbl_writer, a.inbl_writer_name, 'inbl', a.inbl_quantity || 0);
    return acc;
  }, {});
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '활성', color: 'text-gray-700', bg: 'bg-gray-100' },
  new: { label: '신규', color: 'text-green-700', bg: 'bg-green-100' },
  changed: { label: '변경', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  terminated: { label: '해지', color: 'text-red-700', bg: 'bg-red-100' },
  ai: { label: 'AI', color: 'text-purple-700', bg: 'bg-purple-100' },
  both: { label: '동시', color: 'text-blue-700', bg: 'bg-blue-100' },
};

export default function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  // 대시보드는 note/branch_id 등을 사용하지 않으므로 Partial 타입 허용
  const [assignments, setAssignments] = useState<Partial<Assignment>[]>([]);
  const [prevAssignments, setPrevAssignments] = useState<Partial<Assignment>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const prevMonth = getAdjacentMonth(month, -1);

    const selectQuery = `id, month, status, renewal_day,
      main_writer_id, main_writer_name, main_quantity,
      sub_writer_id, sub_writer_name, sub_quantity,
      optimal_writer_id, optimal_writer_name, optimal_quantity,
      inbl_writer_id, inbl_writer_name, inbl_quantity,
      branch:branches(id, name, category, product_type),
      main_writer:profiles!assignments_main_writer_id_fkey(name),
      sub_writer:profiles!assignments_sub_writer_id_fkey(name),
      optimal_writer:profiles!assignments_optimal_writer_id_fkey(name),
      inbl_writer:profiles!assignments_inbl_writer_id_fkey(name)`;

    const [assignRes, prevRes] = await Promise.all([
      supabase.from('assignments').select(selectQuery).eq('month', month).order('renewal_day'),
      supabase.from('assignments').select(selectQuery).eq('month', prevMonth),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAssignments((assignRes.data as any) || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPrevAssignments((prevRes.data as any) || []);
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const s = calcWriterStats(assignments);
    const prevS = calcWriterStats(prevAssignments);
    for (const [key, stat] of Object.entries(s)) {
      const prev = prevS[key];
      stat.prevTotal = prev ? prev.mainQty + prev.subQty + prev.optimalQty + prev.inblQty : 0;
    }
    return s;
  }, [assignments, prevAssignments]);

  const { totalPosts, prevTotalPosts, postsDiff, statusCounts, unassigned, sortedWriters } = useMemo(() => {
    const total = assignments.reduce((sum, a) => sum + (a.main_quantity || 0) + (a.sub_quantity || 0) + (a.optimal_quantity || 0) + (a.inbl_quantity || 0), 0);
    const prevTotal = prevAssignments.reduce((sum, a) => sum + (a.main_quantity || 0) + (a.sub_quantity || 0) + (a.optimal_quantity || 0) + (a.inbl_quantity || 0), 0);
    const counts = assignments.reduce<Record<string, number>>((acc, a) => {
      const status = a.status || 'active';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const unas = assignments.filter(a => !a.main_writer_id && !a.main_writer_name);
    const sorted = Object.entries(stats).sort((a, b) => {
      const aT = a[1].mainQty + a[1].subQty + a[1].optimalQty + a[1].inblQty;
      const bT = b[1].mainQty + b[1].subQty + b[1].optimalQty + b[1].inblQty;
      return bT - aT;
    });
    return { totalPosts: total, prevTotalPosts: prevTotal, postsDiff: total - prevTotal, statusCounts: counts, unassigned: unas, sortedWriters: sorted };
  }, [assignments, prevAssignments, stats]);

  return (
    <div className="p-4 max-w-[1200px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">총괄 현황</h2>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* 상단: 핵심 요약 한 줄 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">배정</span>
                <span className="text-lg font-bold">{assignments.length}</span>
                <span className="text-xs text-gray-400">건</span>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">포스팅</span>
                <span className="text-lg font-bold">{totalPosts}</span>
                <span className="text-xs text-gray-400">건</span>
                {totalPosts > 0 && prevTotalPosts > 0 && postsDiff !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${postsDiff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {postsDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {postsDiff > 0 ? `+${postsDiff}` : postsDiff}
                  </span>
                )}
                {totalPosts > 0 && prevTotalPosts > 0 && postsDiff === 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus size={12} />전월동일</span>
                )}
                {totalPosts === 0 && prevTotalPosts > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">배정 전</span>
                )}
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">활동 담당자</span>
                <span className="text-lg font-bold">{Object.keys(stats).length}</span>
                <span className="text-xs text-gray-400">명</span>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              {/* 상태 태그 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const s = STATUS_MAP[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
                  return (
                    <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
                      {s.label} {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 알림: 미배정 */}
          {unassigned.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">사수 미배정 {unassigned.length}건</span>
                <span className="text-amber-600 ml-2">
                  {unassigned.slice(0, 5).map(a => a.branch?.name || '알 수 없음').join(', ')}
                  {unassigned.length > 5 && ` 외 ${unassigned.length - 5}건`}
                </span>
              </p>
            </div>
          )}

          {/* 지점 변동 알림 */}
          <BranchAlerts currentMonth={month} />

          {/* 월간 추이 차트 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">최근 6개월 포스팅 추이</h3>
            <MonthlyTrendChart currentMonth={month} />
          </div>

          {/* 담당자별 수량 테이블 - 메인 콘텐츠 */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">담당자별 작업 수량</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-24">담당자</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-blue-600 w-16">사수</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-green-600 w-16">부사수</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-purple-600 w-16">최적</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-amber-600 w-16">인블</th>
                    <th className="px-3 py-2.5 text-center font-bold text-gray-900 w-16">합계</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-400 w-16">전월</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-400 w-16">변동</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-400 w-14">지점</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWriters.map(([id, s]) => {
                    const total = s.mainQty + s.subQty + s.optimalQty + s.inblQty;
                    const diff = total - s.prevTotal;
                    return (
                      <tr key={id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                        <td className="px-3 py-2 text-center text-blue-600 font-medium">{s.mainQty || <span className="text-gray-200">-</span>}</td>
                        <td className="px-3 py-2 text-center text-green-600 font-medium">{s.subQty || <span className="text-gray-200">-</span>}</td>
                        <td className="px-3 py-2 text-center text-purple-600 font-medium">{s.optimalQty || <span className="text-gray-200">-</span>}</td>
                        <td className="px-3 py-2 text-center text-amber-600 font-medium">{s.inblQty || <span className="text-gray-200">-</span>}</td>
                        <td className="px-3 py-2 text-center font-bold text-gray-900">{total}</td>
                        <td className="px-3 py-2 text-center text-gray-400">{s.prevTotal || <span className="text-gray-200">-</span>}</td>
                        <td className="px-3 py-2 text-center">
                          {s.prevTotal > 0 && diff !== 0 ? (
                            <span className={`text-xs font-semibold ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          ) : (
                            <span className="text-gray-200">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500">{s.branchCount}</td>
                      </tr>
                    );
                  })}
                  {sortedWriters.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">이 달의 배정 데이터가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
