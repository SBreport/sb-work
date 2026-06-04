'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getCurrentMonth } from '@/lib/date';
import MonthSelector from '@/components/MonthSelector';
import StatusBadge from '@/components/StatusBadge';
import InlineEditCell from '@/components/InlineEditCell';
import InlineSelectCell from '@/components/InlineSelectCell';
import AssignmentModal from './AssignmentModal';
import type { Assignment, User, AssignmentStatus } from '@/types/database';
import { Plus, Copy, Download, Trash2, History, X } from 'lucide-react';
import { STATUS_OPTIONS, ASSIGNMENT_STATUS_MAP } from '@/lib/constants';
import { calcWriterStats, totalQty } from '@/lib/stats';

interface LogEntry {
  id: string;
  assignment_id: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by_profile?: { name: string } | null;
}

// ── 헬퍼 함수 ──────────────────────────────────────────────

function operationTypeLabel(v: string): string {
  const map: Record<string, string> = {
    unai: '유앤아이',
    direct: '직',
    solution: '솔루션',
    agency: '대행',
  };
  return map[v] || v;
}

function statusLabel(v: string): string {
  return ASSIGNMENT_STATUS_MAP[v]?.label ?? v;
}

// ── ChipRow 인라인 컴포넌트 ──────────────────────────────────

function ChipRow({
  label,
  items,
  activeValue,
  onClick,
  formatItem,
  colorClass,
  activeColorClass,
}: {
  label: string;
  items: [string, number][];
  activeValue: string | null;
  onClick: (value: string) => void;
  formatItem?: (value: string) => string;
  colorClass: string;
  activeColorClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="font-semibold text-gray-500 shrink-0 w-10 mt-1">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([value, count]) => {
          const isActive = activeValue === value;
          return (
            <button
              key={value}
              onClick={() => onClick(value)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${isActive ? activeColorClass : colorClass}`}
            >
              {formatItem ? formatItem(value) : value}{' '}
              <span className="font-normal opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SortableHeaderCell 인라인 컴포넌트 ──────────────────────

type SortKey = 'name' | 'mainQty' | 'subQty' | 'optimalQty' | 'inblQty' | 'total' | 'branchCount';

function SortableHeaderCell({
  sortKey,
  current,
  onSort,
  align,
  color,
  children,
}: {
  sortKey: SortKey;
  current: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (s: { key: SortKey; dir: 'asc' | 'desc' }) => void;
  align: 'left' | 'right';
  color: string;
  children: React.ReactNode;
}) {
  const isActive = current.key === sortKey;
  return (
    <th
      onClick={() =>
        onSort(
          isActive
            ? { key: sortKey, dir: current.dir === 'asc' ? 'desc' : 'asc' }
            : { key: sortKey, dir: sortKey === 'name' ? 'asc' : 'desc' }
        )
      }
      className={`px-3 py-2 font-semibold ${color} text-${align} cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none`}
    >
      {children}
      {isActive && (
        <span className="ml-1 text-[10px]">{current.dir === 'asc' ? '▲' : '▼'}</span>
      )}
    </th>
  );
}

// ── 통합 필터 타입 ──────────────────────────────────────────

type ActiveFilter =
  | { type: 'writer'; key: string; label: string }
  | { type: 'category'; value: string }
  | { type: 'operationType'; value: string }
  | { type: 'status'; value: AssignmentStatus };

// ── 메인 컴포넌트 ───────────────────────────────────────────

export default function AssignmentsPage() {
  const { user, isEditor } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [writers, setWriters] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  // 셀 편집 대기 상태 — assignmentId별로 변경된 필드만 누적
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<Assignment>>>({});
  const [saving, setSaving] = useState(false);

  // 통합 필터
  const [filter, setFilter] = useState<ActiveFilter | null>(null);
  // 집계 탭
  const [statTab, setStatTab] = useState<'branch' | 'writer'>('branch');
  // 담당자별 탭 정렬
  const [statSort, setStatSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'total',
    dir: 'desc',
  });

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
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
    setAssignments(data || []);
    setLoading(false);
  }, [month]);

  const fetchWriters = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('is_active', true)
      .neq('role', 'admin')
      .order('name');
    setWriters(data || []);
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchWriters();
  }, [fetchAssignments, fetchWriters]);

  // 월 변경 시 pending + 필터 초기화
  useEffect(() => {
    setPendingChanges({});
    setFilter(null);
  }, [month]);

  // 페이지 떠나기 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingChanges).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingChanges]);

  // 표시 데이터 = 원본 + pendingChanges 머지
  const displayAssignments = useMemo(
    () => assignments.map(a => ({ ...a, ...(pendingChanges[a.id] || {}) })),
    [assignments, pendingChanges]
  );

  // 인라인 필드 업데이트 — API 호출 없이 pending에만 누적
  const updateField = (id: string, field: string, value: unknown) => {
    setPendingChanges(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value as Assignment[keyof Assignment] },
    }));
  };

  // 담당자 변경 — API 호출 없이 pending에만 누적 (여러 필드 한번에 머지)
  const updateWriter = (id: string, role: string, writerId: string) => {
    const writer = writers.find(w => w.id === writerId);
    const patch: Partial<Assignment> = {
      [`${role}_writer_id`]: (writerId || null) as unknown as Assignment[keyof Assignment],
      [`${role}_writer_name`]: (writer?.name || null) as unknown as Assignment[keyof Assignment],
      [`${role}_writer`]: (writer || null) as unknown as Assignment[keyof Assignment],
    };
    setPendingChanges(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  // 일괄 저장 — pending 항목들을 병렬 PATCH
  const handleSave = async () => {
    setSaving(true);
    const entries = Object.entries(pendingChanges);
    try {
      await Promise.all(
        entries.map(([id, fields]) => {
          // writer 객체 필드는 API에 보내지 않음 (DB 컬럼 아님)
          const { main_writer, sub_writer, optimal_writer, inbl_writer, ...dbFields } =
            fields as Record<string, unknown>;
          void main_writer;
          void sub_writer;
          void optimal_writer;
          void inbl_writer;
          if (Object.keys(dbFields).length === 0) return Promise.resolve();
          return authFetch('/api/assignments/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assignment_id: id,
              updates: dbFields,
              changed_by: user?.id,
            }),
          });
        })
      );
      setPendingChanges({});
      await fetchAssignments();
    } catch {
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (Object.keys(pendingChanges).length > 0 && !confirm('변경사항을 취소하시겠습니까?')) return;
    setPendingChanges({});
  };

  // 이력 조회
  const fetchLogs = async () => {
    setLogsLoading(true);
    const res = await authFetch(`/api/assignments/logs?month=${month}&limit=100`);
    const data = await res.json();
    setLogs(data.logs || []);
    setLogsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 배정을 삭제하시겠습니까?')) return;
    await supabase.from('assignments').delete().eq('id', id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const handleCopyPrevMonth = async () => {
    const [year, mon] = month.split('-').map(Number);
    let prevMonth = mon - 1;
    let prevYear = year;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear--;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    if (!confirm(`${prevYear}년 ${prevMonth}월 데이터를 현재 월로 복사하시겠습니까?`)) return;

    const { data: prevAssignments } = await supabase
      .from('assignments')
      .select('*')
      .eq('month', prevMonthStr);

    if (!prevAssignments || prevAssignments.length === 0) {
      alert('이전 월에 데이터가 없습니다.');
      return;
    }

    const newAssignments = prevAssignments.map(({ id, created_at, ...rest }) => ({
      ...rest,
      month,
    }));

    await supabase.from('assignments').insert(newAssignments);
    fetchAssignments();
  };

  // CSV 내보내기
  const handleExportCSV = () => {
    if (assignments.length === 0) return;

    const headers = [
      '갱신일',
      '과목',
      '유형',
      '지점명',
      '사수',
      '사수수량',
      '부사수',
      '부사수수량',
      '최적배포',
      '최적수량',
      '인블',
      '인블수량',
      '상태',
      '비고',
    ];
    const rows = assignments.map(a => [
      `${a.renewal_day}일`,
      (a.branch?.category || '').replace(/,/g, ''),
      a.branch?.product_type || '',
      a.branch?.name || '',
      a.main_writer?.name || a.main_writer_name || '',
      a.main_quantity,
      a.sub_writer?.name || a.sub_writer_name || '',
      a.sub_quantity,
      a.optimal_writer?.name || a.optimal_writer_name || '',
      a.optimal_quantity,
      a.inbl_writer?.name || a.inbl_writer_name || '',
      a.inbl_quantity,
      STATUS_OPTIONS.find(s => s.value === a.status)?.label || a.status,
      a.note || '',
    ]);

    const bom = '﻿';
    const csv =
      bom +
      [headers, ...rows]
        .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `배정현황_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 담당자 드롭다운 옵션
  const writerOptions = writers.map(w => ({ value: w.id, label: w.name }));

  // 담당자별 수량 집계 — pending 변경사항 반영된 displayAssignments 기준
  const writerSummary = useMemo(() => calcWriterStats(displayAssignments), [displayAssignments]);

  // 정렬된 summary (담당자별 탭용)
  const sortedSummary = useMemo(() => {
    const entries = Object.entries(writerSummary);
    const { key, dir } = statSort;
    entries.sort(([, a], [, b]) => {
      let av: number | string;
      let bv: number | string;
      if (key === 'total') {
        av = totalQty(a);
        bv = totalQty(b);
      } else if (key === 'name') {
        av = a.name;
        bv = b.name;
      } else {
        av = a[key as keyof typeof a] as number;
        bv = b[key as keyof typeof b] as number;
      }
      const cmp =
        typeof av === 'string'
          ? av.localeCompare(bv as string, 'ko')
          : (av as number) - (bv as number);
      return dir === 'asc' ? cmp : -cmp;
    });
    return entries;
  }, [writerSummary, statSort]);

  // 지점별 집계
  const branchStats = useMemo(() => {
    const branchIds = new Set<string>();
    const categoryCount: Record<string, number> = {};
    const operationCount: Record<string, number> = {};
    const statusCount: Record<string, number> = {};

    for (const a of displayAssignments) {
      if (a.branch_id) branchIds.add(a.branch_id);
      const cat = a.branch?.category ?? '';
      if (cat) categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      const op = a.operation_type ?? '';
      if (op) operationCount[op] = (operationCount[op] || 0) + 1;
      const st = a.status;
      if (st) statusCount[st] = (statusCount[st] || 0) + 1;
    }

    return {
      totalBranches: branchIds.size,
      totalAssignments: displayAssignments.length,
      categories: Object.entries(categoryCount).sort((a, b) => b[1] - a[1]),
      operations: Object.entries(operationCount).sort((a, b) => b[1] - a[1]),
      statuses: Object.entries(statusCount).sort((a, b) => b[1] - a[1]),
    };
  }, [displayAssignments]);

  // 통합 필터 적용된 배정 목록
  const filteredAssignments = useMemo(() => {
    if (!filter) return displayAssignments;
    return displayAssignments.filter(a => {
      switch (filter.type) {
        case 'writer': {
          const isNameKey = filter.key.startsWith('name:');
          const target = isNameKey ? filter.key.slice(5) : filter.key;
          if (isNameKey)
            return [
              a.main_writer_name,
              a.sub_writer_name,
              a.optimal_writer_name,
              a.inbl_writer_name,
            ].includes(target);
          return [
            a.main_writer_id,
            a.sub_writer_id,
            a.optimal_writer_id,
            a.inbl_writer_id,
          ].includes(target);
        }
        case 'category':
          return (a.branch?.category ?? '') === filter.value;
        case 'operationType':
          return (a.operation_type ?? '') === filter.value;
        case 'status':
          return a.status === filter.value;
      }
    });
  }, [displayAssignments, filter]);

  // 활성 필터 표시 레이블
  const filterLabel = useMemo(() => {
    if (!filter) return null;
    switch (filter.type) {
      case 'writer':
        return `${filter.label}님 필터`;
      case 'category':
        return `${filter.value} 필터`;
      case 'operationType':
        return `${operationTypeLabel(filter.value)} 필터`;
      case 'status':
        return `${statusLabel(filter.value)} 필터`;
    }
  }, [filter]);

  const getWriterDisplay = (writer: unknown, name: string | null | undefined, role: string) => {
    const writerName = (writer as { name?: string; id?: string } | null)?.name || name;
    const writerId = (writer as { id?: string } | null)?.id || '';
    const colorMap: Record<string, string> = {
      main: 'bg-blue-50 text-blue-700',
      sub: 'bg-green-50 text-green-700',
      optimal: 'bg-purple-50 text-purple-700',
      inbl: 'bg-amber-50 text-amber-700',
    };
    return { writerName: writerName || '', writerId, colorClass: colorMap[role] || '' };
  };

  return (
    <div className="p-4 max-w-full">
      {/* 변경사항 대기 바 */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="sticky top-0 z-20 bg-amber-50 border-b border-amber-300 px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm -mx-4 mb-4">
          <span className="text-sm text-amber-800">
            <strong>{Object.keys(pendingChanges).length}건</strong>의 변경사항이 저장 대기 중입니다.
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">배정 관리</h2>
          <MonthSelector month={month} onChange={setMonth} />
        </div>
        {!isEditor && (
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={assignments.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={handleCopyPrevMonth}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Copy size={14} />
              전월 복사
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} />
              새 배정
            </button>
          </div>
        )}
      </div>

      {/* 인라인 편집 안내 */}
      {!isEditor && <p className="text-xs text-gray-400 mb-2">셀을 클릭하면 바로 수정할 수 있습니다.</p>}

      {/* ── 집계 영역 (탭 토글) ── */}
      {displayAssignments.length > 0 && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* 헤더: 탭 + 활성 필터 표시 */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
            <div className="flex gap-1">
              {(['branch', 'writer'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setStatTab(t)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded ${
                    statTab === t
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t === 'branch' ? '지점별 확인' : '담당자별 확인'}
                </button>
              ))}
            </div>
            {filter && filterLabel && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-700 font-medium">{filterLabel}</span>
                <button
                  onClick={() => setFilter(null)}
                  className="text-blue-500 hover:text-blue-700"
                  aria-label="필터 해제"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* 본문: 탭별 */}
          <div className="p-3">
            {statTab === 'branch' ? (
              /* ── 지점별 확인 ── */
              <div className="space-y-2.5">
                <p className="text-xs text-gray-500">
                  총{' '}
                  <span className="font-bold text-gray-900">{branchStats.totalBranches}</span>개 지점 ·{' '}
                  <span className="font-bold text-gray-900">{branchStats.totalAssignments}</span>건 배정
                </p>

                <ChipRow
                  label="과목"
                  items={branchStats.categories}
                  activeValue={filter?.type === 'category' ? filter.value : null}
                  onClick={value =>
                    setFilter(
                      filter?.type === 'category' && filter.value === value
                        ? null
                        : { type: 'category', value }
                    )
                  }
                  colorClass="bg-gray-100 text-gray-700 hover:bg-gray-200"
                  activeColorClass="bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                />

                <ChipRow
                  label="구분"
                  items={branchStats.operations}
                  activeValue={filter?.type === 'operationType' ? filter.value : null}
                  onClick={value =>
                    setFilter(
                      filter?.type === 'operationType' && filter.value === value
                        ? null
                        : { type: 'operationType', value }
                    )
                  }
                  formatItem={operationTypeLabel}
                  colorClass="bg-gray-100 text-gray-700 hover:bg-gray-200"
                  activeColorClass="bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                />

                <ChipRow
                  label="상태"
                  items={branchStats.statuses}
                  activeValue={filter?.type === 'status' ? filter.value : null}
                  onClick={value =>
                    setFilter(
                      filter?.type === 'status' && filter.value === value
                        ? null
                        : { type: 'status', value: value as AssignmentStatus }
                    )
                  }
                  formatItem={statusLabel}
                  colorClass="bg-gray-100 text-gray-700 hover:bg-gray-200"
                  activeColorClass="bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                />
              </div>
            ) : (
              /* ── 담당자별 확인 ── */
              <div className="max-w-[720px]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <SortableHeaderCell
                        sortKey="name"
                        current={statSort}
                        onSort={setStatSort}
                        align="left"
                        color="text-gray-600"
                      >
                        담당자
                      </SortableHeaderCell>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                        역할별
                      </th>
                      <SortableHeaderCell
                        sortKey="total"
                        current={statSort}
                        onSort={setStatSort}
                        align="right"
                        color="text-gray-700"
                      >
                        합계
                      </SortableHeaderCell>
                      <SortableHeaderCell
                        sortKey="branchCount"
                        current={statSort}
                        onSort={setStatSort}
                        align="right"
                        color="text-gray-500"
                      >
                        지점
                      </SortableHeaderCell>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedSummary.map(([key, s]) => {
                      const isSelected =
                        filter?.type === 'writer' && filter.key === key;
                      return (
                        <tr
                          key={key}
                          onClick={() =>
                            setFilter(
                              isSelected
                                ? null
                                : { type: 'writer', key, label: s.name }
                            )
                          }
                          className={`cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 hover:bg-blue-100'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                            {s.name}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                              {s.mainQty > 0 && (
                                <span className="text-blue-600">사 {s.mainQty}</span>
                              )}
                              {s.subQty > 0 && (
                                <span className="text-green-600">부 {s.subQty}</span>
                              )}
                              {s.optimalQty > 0 && (
                                <span className="text-purple-600">최 {s.optimalQty}</span>
                              )}
                              {s.inblQty > 0 && (
                                <span className="text-amber-600">인 {s.inblQty}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-gray-900 whitespace-nowrap">
                            {totalQty(s)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap">
                            {s.branchCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 배정 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600 w-14">갱신일</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600 w-20">과목</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">지점명</th>
                <th className="px-2 py-2.5 text-left font-semibold text-blue-600 w-32 whitespace-nowrap">사수</th>
                <th className="px-2 py-2.5 text-left font-semibold text-green-600 w-32 whitespace-nowrap">부사수</th>
                <th className="px-2 py-2.5 text-left font-semibold text-purple-600 w-32 whitespace-nowrap">최적</th>
                <th className="px-2 py-2.5 text-left font-semibold text-amber-600 w-36 whitespace-nowrap">인블</th>
                <th className="px-2 py-2.5 text-center font-semibold text-gray-600 w-16">상태</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">비고</th>
                {!isEditor && (
                  <th className="px-2 py-2.5 text-center font-semibold text-gray-600 w-8"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    배정 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map(a => {
                  const main = getWriterDisplay(a.main_writer, a.main_writer_name, 'main');
                  const sub = getWriterDisplay(a.sub_writer, a.sub_writer_name, 'sub');
                  const opt = getWriterDisplay(a.optimal_writer, a.optimal_writer_name, 'optimal');
                  const inbl = getWriterDisplay(a.inbl_writer, a.inbl_writer_name, 'inbl');

                  const renderWriterCell = (
                    writerName: string,
                    colorClass: string,
                    writerId: string,
                    role: string
                  ) => {
                    if (isEditor) {
                      return (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${writerName ? colorClass : ''}`}
                        >
                          {writerName || '-'}
                        </span>
                      );
                    }
                    return (
                      <InlineSelectCell
                        value={writerId}
                        options={writerOptions}
                        onSave={v => updateWriter(a.id, role, v)}
                        renderDisplay={(_, label) => (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${writerName ? colorClass : ''}`}
                          >
                            {writerName || label}
                          </span>
                        )}
                        placeholder="-"
                      />
                    );
                  };

                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      {/* 갱신일 */}
                      <td className="px-2 py-1.5">
                        {isEditor ? (
                          <span className="text-gray-600">{a.renewal_day}</span>
                        ) : (
                          <InlineEditCell
                            value={a.renewal_day}
                            type="number"
                            min={1}
                            onSave={v => updateField(a.id, 'renewal_day', v)}
                            displayClassName="text-gray-600"
                          />
                        )}
                      </td>
                      {/* 과목 */}
                      <td className="px-2 py-1.5">
                        <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {(a.branch?.category || '').replace(/,/g, '')}
                        </span>
                      </td>
                      {/* 지점명 */}
                      <td className="px-2 py-1.5 font-medium text-gray-900">{a.branch?.name}</td>
                      {/* 사수 */}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate">
                            {renderWriterCell(main.writerName, main.colorClass, a.main_writer_id || '', 'main')}
                          </div>
                          <div className="text-blue-600 font-semibold text-right shrink-0 w-8">
                            {isEditor ? (
                              <span>{a.main_quantity}</span>
                            ) : (
                              <InlineEditCell
                                value={a.main_quantity}
                                type="number"
                                min={0}
                                onSave={v => updateField(a.id, 'main_quantity', v)}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      {/* 부사수 */}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate">
                            {renderWriterCell(sub.writerName, sub.colorClass, a.sub_writer_id || '', 'sub')}
                          </div>
                          <div className="text-green-600 font-semibold text-right shrink-0 w-8">
                            {isEditor ? (
                              <span>{a.sub_quantity}</span>
                            ) : (
                              <InlineEditCell
                                value={a.sub_quantity}
                                type="number"
                                min={0}
                                onSave={v => updateField(a.id, 'sub_quantity', v)}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      {/* 최적배포 */}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate">
                            {renderWriterCell(opt.writerName, opt.colorClass, a.optimal_writer_id || '', 'optimal')}
                          </div>
                          <div className="text-purple-600 font-semibold text-right shrink-0 w-8">
                            {isEditor ? (
                              <span>{a.optimal_quantity}</span>
                            ) : (
                              <InlineEditCell
                                value={a.optimal_quantity}
                                type="number"
                                min={0}
                                onSave={v => updateField(a.id, 'optimal_quantity', v)}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      {/* 인블 */}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate">
                            {renderWriterCell(inbl.writerName, inbl.colorClass, a.inbl_writer_id || '', 'inbl')}
                          </div>
                          <div className="text-amber-600 font-semibold text-right shrink-0 w-8">
                            {isEditor ? (
                              <span>{a.inbl_quantity}</span>
                            ) : (
                              <InlineEditCell
                                value={a.inbl_quantity}
                                type="number"
                                min={0}
                                onSave={v => updateField(a.id, 'inbl_quantity', v)}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      {/* 상태 */}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        {isEditor ? (
                          <StatusBadge status={a.status as AssignmentStatus} />
                        ) : (
                          <InlineSelectCell
                            value={a.status}
                            options={STATUS_OPTIONS}
                            onSave={v => updateField(a.id, 'status', v)}
                            renderDisplay={() => <StatusBadge status={a.status as AssignmentStatus} />}
                          />
                        )}
                      </td>
                      {/* 비고 */}
                      <td className="px-2 py-1.5">
                        {isEditor ? (
                          <span className="text-gray-500 max-w-[150px] truncate">{a.note || '-'}</span>
                        ) : (
                          <InlineEditCell
                            value={a.note || ''}
                            onSave={v => updateField(a.id, 'note', v)}
                            placeholder="-"
                            displayClassName="text-gray-500 max-w-[150px] truncate"
                          />
                        )}
                      </td>
                      {/* 삭제 */}
                      {!isEditor && (
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 변경 이력 */}
      <div className="mt-4">
        <button
          onClick={() => {
            setShowLogs(!showLogs);
            if (!showLogs) fetchLogs();
          }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          <History size={14} />
          {showLogs ? '변경 이력 닫기' : '변경 이력 보기'}
        </button>

        {showLogs && (
          <div className="mt-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700">변경 이력 (최근 100건)</h3>
              <button onClick={fetchLogs} className="text-xs text-blue-600 hover:underline">
                새로고침
              </button>
            </div>
            {logsLoading ? (
              <div className="px-4 py-6 text-center text-gray-400 text-xs">로딩 중...</div>
            ) : logs.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-xs">
                변경 이력이 없습니다.
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">시간</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">변경자</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">항목</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">이전 값</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-400">→</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">변경 값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                          {new Date(log.changed_at).toLocaleString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-1.5 font-medium text-gray-700">
                          {log.changed_by_profile?.name || '시스템'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                            {log.field_changed}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-red-500">{log.old_value || '(없음)'}</td>
                        <td className="px-3 py-1.5 text-center text-gray-300">→</td>
                        <td className="px-3 py-1.5 text-green-600 font-medium">
                          {log.new_value || '(없음)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 새 배정 모달 */}
      {modalOpen && (
        <AssignmentModal
          assignment={null}
          month={month}
          writers={writers}
          onClose={() => setModalOpen(false)}
          onSave={() => {
            setModalOpen(false);
            fetchAssignments();
          }}
        />
      )}
    </div>
  );
}
