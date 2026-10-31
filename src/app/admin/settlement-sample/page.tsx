'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDollarSign, FileText, Send, WalletCards } from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import { getCurrentMonth } from '@/lib/date';
import { calcWriterStats, totalQty } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import type { Assignment } from '@/types/database';
import { isBranding } from '@/lib/blog-assignment';

type SettlementStatus = 'not_requested' | 'requested' | 'approved' | 'paid';

const STATUS_LABELS: Record<SettlementStatus, string> = {
  not_requested: '요청 전',
  requested: '정산 요청',
  approved: '승인',
  paid: '이체 완료',
};

const STATUS_STYLES: Record<SettlementStatus, string> = {
  not_requested: 'bg-gray-100 text-gray-600',
  requested: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
};

function assignmentBelongsToWriter(assignment: Assignment, key: string, name: string) {
  if (key.startsWith('name:')) {
    return [
      assignment.main_writer_name,
      assignment.sub_writer_name,
      assignment.optimal_writer_name,
      assignment.inbl_writer_name,
      assignment.clinical_writer_name,
    ].includes(name);
  }

  return [
    assignment.main_writer_id,
    assignment.sub_writer_id,
    assignment.optimal_writer_id,
    assignment.inbl_writer_id,
    assignment.clinical_writer_id,
  ].includes(key);
}

function writerRoleSummary(assignment: Assignment, key: string, name: string) {
  const roles: string[] = [];
  const matches = (id: string | null, fallbackName: string | null) =>
    key.startsWith('name:') ? fallbackName === name : id === key;

  if (isBranding(assignment)) {
    if (assignment.information_quantity == null && assignment.clinical_quantity == null) {
      if (matches(assignment.main_writer_id, assignment.main_writer_name)) roles.push(`블로그(유형 미구분) ${assignment.main_quantity}`);
    } else {
      if (matches(assignment.main_writer_id, assignment.main_writer_name)) roles.push(`정보형 ${assignment.information_quantity || 0}`);
      if (matches(assignment.clinical_writer_id || null, assignment.clinical_writer_name || null)) roles.push(`임상/논문형 ${assignment.clinical_quantity || 0}`);
    }
    if (matches(assignment.sub_writer_id, assignment.sub_writer_name)) roles.push(`SEO ${assignment.sub_quantity || 0}`);
    if (matches(assignment.optimal_writer_id, assignment.optimal_writer_name)) roles.push(`최적 ${assignment.optimal_quantity || 0}`);
    if (matches(assignment.inbl_writer_id, assignment.inbl_writer_name)) roles.push(`인블 ${assignment.inbl_quantity || 0}`);
    return roles.join(' · ');
  }
  if (matches(assignment.main_writer_id, assignment.main_writer_name)) roles.push(`사수 ${assignment.main_quantity || 0}`);
  if (matches(assignment.sub_writer_id, assignment.sub_writer_name)) roles.push(`부사수 ${assignment.sub_quantity || 0}`);
  if (matches(assignment.optimal_writer_id, assignment.optimal_writer_name)) roles.push(`최적 ${assignment.optimal_quantity || 0}`);
  if (matches(assignment.inbl_writer_id, assignment.inbl_writer_name)) roles.push(`인블 ${assignment.inbl_quantity || 0}`);
  return roles.join(' · ');
}

export default function SettlementSamplePage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedWriterKey, setSelectedWriterKey] = useState<string | null>(null);
  const [demoStatuses, setDemoStatuses] = useState<Record<string, SettlementStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      const { data, error: queryError } = await supabase
        .from('assignments')
        .select(`
          *,
          branch:branches(id, name, category, product_type, status),
          main_writer:profiles!assignments_main_writer_id_fkey(id, name),
          sub_writer:profiles!assignments_sub_writer_id_fkey(id, name),
          optimal_writer:profiles!assignments_optimal_writer_id_fkey(id, name),
          inbl_writer:profiles!assignments_inbl_writer_id_fkey(id, name)
        `)
        .eq('month', month)
        .order('renewal_day', { ascending: true });

      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setAssignments([]);
      } else {
        setError(null);
        setAssignments((data as Assignment[]) || []);
      }
      setLoading(false);
    }

    void loadAssignments();
    return () => { cancelled = true; };
  }, [month]);

  const writers = useMemo(() => {
    const stats = calcWriterStats(assignments);
    return Object.entries(stats).sort(([, a], [, b]) => totalQty(b) - totalQty(a));
  }, [assignments]);

  const activeWriterKey = selectedWriterKey && writers.some(([key]) => key === selectedWriterKey)
    ? selectedWriterKey
    : writers[0]?.[0] ?? null;
  const activeWriter = writers.find(([key]) => key === activeWriterKey);
  const activeWriterName = activeWriter?.[1].name ?? '';
  const activeWriterAssignments = useMemo(
    () => activeWriterKey
      ? assignments.filter(assignment => assignmentBelongsToWriter(assignment, activeWriterKey, activeWriterName))
      : [],
    [activeWriterKey, activeWriterName, assignments]
  );

  const totalAssigned = writers.reduce((sum, [, stats]) => sum + totalQty(stats), 0);
  const activeStatus = activeWriterKey ? demoStatuses[activeWriterKey] ?? 'not_requested' : 'not_requested';

  const changeMonth = (nextMonth: string) => {
    setLoading(true);
    setError(null);
    setSelectedWriterKey(null);
    setDemoStatuses({});
    setMonth(nextMonth);
  };

  const setDemoStatus = (writerKey: string, status: SettlementStatus) => {
    setDemoStatuses(current => ({ ...current, [writerKey]: status }));
  };

  return (
    <div className="p-4 max-w-[1280px] mx-auto space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">작업 배정·정산 흐름 샘플</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">읽기 전용 데모</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            실제 배정 데이터를 사용하며, 정산 요청·승인·이체 상태는 화면 시연용으로만 변경됩니다.
          </p>
        </div>
        <MonthSelector month={month} onChange={changeMonth} />
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { step: '1', title: '회사에서 작업 배정', description: '지점·역할·수량을 담당자에게 배정', icon: WalletCards },
          { step: '2', title: '담당자가 정산 요청', description: '본인 작업량 확인 후 견적서 제출', icon: Send },
          { step: '3', title: '결제 담당자가 이체', description: '작업량과 견적서를 대조한 뒤 처리', icon: CircleDollarSign },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.step} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{item.step}</span>
                <Icon size={19} className="text-gray-400" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{item.description}</p>
            </div>
          );
        })}
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">데이터 조회 실패: {error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">배정 지점</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{assignments.length}<span className="ml-1 text-sm font-normal text-gray-400">건</span></p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">활동 담당자</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{writers.length}<span className="ml-1 text-sm font-normal text-gray-400">명</span></p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">총 작업량</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalAssigned}<span className="ml-1 text-sm font-normal text-gray-400">건</span></p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">결제 담당자 화면 — 담당자별 정산 목록</h3>
            <p className="mt-0.5 text-xs text-gray-500">실제 역할별 작업량을 월 단위로 합산합니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="px-4 py-2.5 text-left font-semibold">담당자</th>
                  <th className="px-3 py-2.5 text-center font-semibold">사수</th>
                  <th className="px-3 py-2.5 text-center font-semibold">부사수</th>
                  <th className="px-3 py-2.5 text-center font-semibold">최적</th>
                  <th className="px-3 py-2.5 text-center font-semibold">인블</th>
                  <th className="px-3 py-2.5 text-center font-semibold">합계</th>
                  <th className="px-3 py-2.5 text-center font-semibold">정산 상태</th>
                </tr>
              </thead>
              <tbody>
                {writers.map(([key, stats]) => {
                  const status = demoStatuses[key] ?? 'not_requested';
                  const selected = key === activeWriterKey;
                  return (
                    <tr
                      key={key}
                      onClick={() => setSelectedWriterKey(key)}
                      className={`cursor-pointer border-b border-gray-100 transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">{stats.name}</td>
                      <td className="px-3 py-2.5 text-center text-blue-600">{stats.mainQty || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-green-600">{stats.subQty || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-purple-600">{stats.optimalQty || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-amber-600">{stats.inblQty || '-'}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-gray-900">{totalQty(stats)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && writers.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">이 달의 배정 데이터가 없습니다.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">배정 데이터를 불러오는 중입니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-blue-600">작업자 화면 미리보기</p>
              <h3 className="mt-1 text-lg font-bold text-gray-900">{activeWriterName || '담당자를 선택하세요'}</h3>
            </div>
            {activeWriter && (
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[activeStatus]}`}>
                {STATUS_LABELS[activeStatus]}
              </span>
            )}
          </div>

          {activeWriter ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">정산 대상 작업량</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{totalQty(activeWriter[1])}건</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">배정 지점</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{activeWriterAssignments.length}곳</p>
                </div>
              </div>

              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                {activeWriterAssignments.map(assignment => (
                  <div key={assignment.id} className="rounded-lg border border-gray-100 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{assignment.branch?.name || '지점 정보 없음'}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{assignment.branch?.category || '분류 없음'} · 갱신일 {assignment.renewal_day || '-'}일</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-blue-700">
                        {writerRoleSummary(assignment, activeWriter[0], activeWriter[1].name)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FileText size={16} /> 견적서 첨부 영역
                </div>
                <p className="mt-1 text-xs text-gray-500">현재 DB에는 견적서와 요청 금액 필드가 없어 실제 파일은 표시하지 않습니다.</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {activeStatus === 'not_requested' && (
                  <button onClick={() => setDemoStatus(activeWriter[0], 'requested')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                    정산 요청 시연
                  </button>
                )}
                {activeStatus === 'requested' && (
                  <button onClick={() => setDemoStatus(activeWriter[0], 'approved')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                    견적 확인·승인 시연
                  </button>
                )}
                {activeStatus === 'approved' && (
                  <button onClick={() => setDemoStatus(activeWriter[0], 'paid')} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
                    이체 완료 시연
                  </button>
                )}
                {activeStatus === 'paid' && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                    <CheckCircle2 size={15} /> 처리 완료
                  </span>
                )}
                {activeStatus !== 'not_requested' && (
                  <button onClick={() => setDemoStatus(activeWriter[0], 'not_requested')} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    데모 초기화
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-gray-400">표에서 담당자를 선택하면 작업자 화면이 표시됩니다.</div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">현재 데이터가 이 화면에서 사용되는 방식</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['assignments.month', '조회 월과 월별 정산 묶음 기준'],
            ['*_writer_id / *_writer_name', '담당자를 식별하고 작업을 담당자별로 묶는 기준'],
            ['*_quantity', '사수·부사수·최적·인블 작업량 합계'],
            ['branches.name / category', '작업자가 견적 전 확인할 지점 상세'],
            ['assignments.status', '신규·변경·중단 등 업무 상태이며 정산 상태와는 별개'],
            ['신규 정산 데이터 필요', '요청 금액, 견적서, 요청·승인·이체 일시와 처리자'],
          ].map(([field, usage]) => (
            <div key={field} className="rounded-lg bg-gray-50 p-3">
              <p className="font-mono text-xs font-semibold text-blue-700">{field}</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{usage}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
