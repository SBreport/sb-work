'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentMonth, getAdjacentMonth } from '@/lib/date';
import MonthSelector from '@/components/MonthSelector';
import dynamic from 'next/dynamic';

const MonthlyTrendChart = dynamic(() => import('@/components/MonthlyTrendChart'), {
  loading: () => <div className="h-80 bg-gray-50 rounded-lg animate-pulse" />,
  ssr: false,
});
import BranchAlerts from '@/components/BranchAlerts';
import type { Assignment, AssignmentStatus } from '@/types/database';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calcWriterStats, totalQty } from '@/lib/stats';
import { ASSIGNMENT_STATUS_MAP } from '@/lib/constants';

export default function DashboardView() {
  const [month, setMonth] = useState(getCurrentMonth());
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
      stat.prevTotal = prev ? totalQty(prev) : 0;
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
      const aT = totalQty(a[1]);
      const bT = totalQty(b[1]);
      return bT - aT;
    });
    return { totalPosts: total, prevTotalPosts: prevTotal, postsDiff: total - prevTotal, statusCounts: counts, unassigned: unas, sortedWriters: sorted };
  }, [assignments, prevAssignments, stats]);

  return (
    <div className="p-4 max-w-[1200px]">
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
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const s = ASSIGNMENT_STATUS_MAP[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
                  return (
                    <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
                      {s.label} {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

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

          <BranchAlerts currentMonth={month} />

          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">최근 6개월 포스팅 추이</h3>
            <MonthlyTrendChart currentMonth={month} />
          </div>

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
                    const total = totalQty(s);
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
