'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MonthSelector from '@/components/MonthSelector';
import StatusBadge from '@/components/StatusBadge';
import InlineEditCell from '@/components/InlineEditCell';
import InlineSelectCell from '@/components/InlineSelectCell';
import AssignmentModal from './AssignmentModal';
import type { Assignment, User, AssignmentStatus } from '@/types/database';
import { Plus, Copy, Download, Trash2, History } from 'lucide-react';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_OPTIONS = [
  { value: 'active', label: '활성' },
  { value: 'new', label: '신규' },
  { value: 'changed', label: '변경' },
  { value: 'terminated', label: '해지' },
  { value: 'ai', label: 'AI' },
  { value: 'both', label: '동시' },
];

interface LogEntry {
  id: string;
  assignment_id: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by_profile?: { name: string } | null;
}

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
      .order('name');
    setWriters(data || []);
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchWriters();
  }, [fetchAssignments, fetchWriters]);

  // 인라인 필드 업데이트 (로깅 포함)
  const updateField = async (id: string, field: string, value: unknown) => {
    await authFetch('/api/assignments/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignment_id: id,
        updates: { [field]: value },
        changed_by: user?.id,
      }),
    });
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // 담당자 변경 (로깅 포함)
  const updateWriter = async (id: string, role: string, writerId: string) => {
    const writer = writers.find(w => w.id === writerId);
    const updates: Record<string, unknown> = {
      [`${role}_writer_id`]: writerId || null,
      [`${role}_writer_name`]: writer?.name || null,
    };
    await authFetch('/api/assignments/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignment_id: id,
        updates,
        changed_by: user?.id,
      }),
    });
    setAssignments(prev => prev.map(a => {
      if (a.id !== id) return a;
      return { ...a, ...updates, [`${role}_writer`]: writer || null };
    }));
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
    if (prevMonth < 1) { prevMonth = 12; prevYear--; }
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

    const headers = ['갱신일', '과목', '유형', '지점명', '사수', '사수수량', '부사수', '부사수수량', '최적배포', '최적수량', '인블', '인블수량', '상태', '비고'];
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

    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
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

  // 담당자별 수량 집계
  const writerSummary = assignments.reduce<Record<string, { name: string; mainQty: number; subQty: number; optimalQty: number; inblQty: number }>>((acc, a) => {
    const addWriter = (id: string | null, nameObj: unknown, nameFallback: string | null | undefined, role: 'main' | 'sub' | 'optimal' | 'inbl', qty: number) => {
      const name = (nameObj as { name?: string } | null)?.name || nameFallback;
      if (!name) return;
      const key = id || `name:${name}`;
      if (!acc[key]) acc[key] = { name, mainQty: 0, subQty: 0, optimalQty: 0, inblQty: 0 };
      if (role === 'main') acc[key].mainQty += qty;
      if (role === 'sub') acc[key].subQty += qty;
      if (role === 'optimal') acc[key].optimalQty += qty;
      if (role === 'inbl') acc[key].inblQty += qty;
    };
    addWriter(a.main_writer_id, a.main_writer, a.main_writer_name, 'main', a.main_quantity);
    addWriter(a.sub_writer_id, a.sub_writer, a.sub_writer_name, 'sub', a.sub_quantity);
    addWriter(a.optimal_writer_id, a.optimal_writer, a.optimal_writer_name, 'optimal', a.optimal_quantity);
    addWriter(a.inbl_writer_id, a.inbl_writer, a.inbl_writer_name, 'inbl', a.inbl_quantity);
    return acc;
  }, {});

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

      {/* 배정 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600 w-14">갱신일</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600 w-20">과목</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">지점명</th>
                <th className="px-2 py-2.5 text-left font-semibold text-blue-600 w-20">사수</th>
                <th className="px-2 py-2.5 text-center font-semibold text-blue-600 w-12">수량</th>
                <th className="px-2 py-2.5 text-left font-semibold text-green-600 w-20">부사수</th>
                <th className="px-2 py-2.5 text-center font-semibold text-green-600 w-12">수량</th>
                <th className="px-2 py-2.5 text-left font-semibold text-purple-600 w-20">최적</th>
                <th className="px-2 py-2.5 text-center font-semibold text-purple-600 w-12">수량</th>
                <th className="px-2 py-2.5 text-left font-semibold text-amber-600 w-20">인블</th>
                <th className="px-2 py-2.5 text-center font-semibold text-amber-600 w-12">수량</th>
                <th className="px-2 py-2.5 text-center font-semibold text-gray-600 w-14">상태</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">비고</th>
                {!isEditor && <th className="px-2 py-2.5 text-center font-semibold text-gray-600 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
              ) : assignments.length === 0 ? (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-400">배정 데이터가 없습니다.</td></tr>
              ) : (
                assignments.map((a) => {
                  const main = getWriterDisplay(a.main_writer, a.main_writer_name, 'main');
                  const sub = getWriterDisplay(a.sub_writer, a.sub_writer_name, 'sub');
                  const opt = getWriterDisplay(a.optimal_writer, a.optimal_writer_name, 'optimal');
                  const inbl = getWriterDisplay(a.inbl_writer, a.inbl_writer_name, 'inbl');

                  const renderWriterCell = (writerName: string, colorClass: string, writerId: string, role: string) => {
                    if (isEditor) {
                      return (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${writerName ? colorClass : ''}`}>
                          {writerName || '-'}
                        </span>
                      );
                    }
                    return (
                      <InlineSelectCell
                        value={writerId}
                        options={writerOptions}
                        onSave={(v) => updateWriter(a.id, role, v)}
                        renderDisplay={(_, label) => (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${writerName ? colorClass : ''}`}>
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
                            onSave={(v) => updateField(a.id, 'renewal_day', v)}
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
                      <td className="px-2 py-1.5 font-medium text-gray-900">
                        {a.branch?.name}
                      </td>
                      {/* 사수 */}
                      <td className="px-2 py-1.5">
                        {renderWriterCell(main.writerName, main.colorClass, a.main_writer_id || '', 'main')}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {isEditor ? <span>{a.main_quantity}</span> : <InlineEditCell value={a.main_quantity} type="number" min={0} onSave={(v) => updateField(a.id, 'main_quantity', v)} />}
                      </td>
                      {/* 부사수 */}
                      <td className="px-2 py-1.5">
                        {renderWriterCell(sub.writerName, sub.colorClass, a.sub_writer_id || '', 'sub')}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {isEditor ? <span>{a.sub_quantity}</span> : <InlineEditCell value={a.sub_quantity} type="number" min={0} onSave={(v) => updateField(a.id, 'sub_quantity', v)} />}
                      </td>
                      {/* 최적배포 */}
                      <td className="px-2 py-1.5">
                        {renderWriterCell(opt.writerName, opt.colorClass, a.optimal_writer_id || '', 'optimal')}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {isEditor ? <span>{a.optimal_quantity}</span> : <InlineEditCell value={a.optimal_quantity} type="number" min={0} onSave={(v) => updateField(a.id, 'optimal_quantity', v)} />}
                      </td>
                      {/* 인블 */}
                      <td className="px-2 py-1.5">
                        {renderWriterCell(inbl.writerName, inbl.colorClass, a.inbl_writer_id || '', 'inbl')}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {isEditor ? <span>{a.inbl_quantity}</span> : <InlineEditCell value={a.inbl_quantity} type="number" min={0} onSave={(v) => updateField(a.id, 'inbl_quantity', v)} />}
                      </td>
                      {/* 상태 */}
                      <td className="px-2 py-1.5 text-center">
                        {isEditor ? (
                          <StatusBadge status={a.status as AssignmentStatus} />
                        ) : (
                          <InlineSelectCell
                            value={a.status}
                            options={STATUS_OPTIONS}
                            onSave={(v) => updateField(a.id, 'status', v)}
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
                            onSave={(v) => updateField(a.id, 'note', v)}
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

      {/* 담당자별 수량 집계 */}
      {Object.keys(writerSummary).length > 0 && (
        <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">담당자별 수량 집계</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {Object.entries(writerSummary)
              .sort((a, b) => (b[1].mainQty + b[1].subQty + b[1].optimalQty + b[1].inblQty) - (a[1].mainQty + a[1].subQty + a[1].optimalQty + a[1].inblQty))
              .map(([id, s]) => (
                <div key={id} className="bg-gray-50 rounded-lg p-2.5">
                  <p className="font-medium text-gray-900 text-xs">{s.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1 text-xs">
                    {s.mainQty > 0 && <span className="text-blue-600">사{s.mainQty}</span>}
                    {s.subQty > 0 && <span className="text-green-600">부{s.subQty}</span>}
                    {s.optimalQty > 0 && <span className="text-purple-600">최{s.optimalQty}</span>}
                    {s.inblQty > 0 && <span className="text-amber-600">인{s.inblQty}</span>}
                  </div>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5">
                    합 {s.mainQty + s.subQty + s.optimalQty + s.inblQty}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 변경 이력 */}
      <div className="mt-4">
        <button
          onClick={() => { setShowLogs(!showLogs); if (!showLogs) fetchLogs(); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          <History size={14} />
          {showLogs ? '변경 이력 닫기' : '변경 이력 보기'}
        </button>

        {showLogs && (
          <div className="mt-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700">변경 이력 (최근 100건)</h3>
              <button onClick={fetchLogs} className="text-xs text-blue-600 hover:underline">새로고침</button>
            </div>
            {logsLoading ? (
              <div className="px-4 py-6 text-center text-gray-400 text-xs">로딩 중...</div>
            ) : logs.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-xs">변경 이력이 없습니다.</div>
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
                          {new Date(log.changed_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-1.5 font-medium text-gray-700">
                          {log.changed_by_profile?.name || '시스템'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{log.field_changed}</span>
                        </td>
                        <td className="px-3 py-1.5 text-red-500">{log.old_value || '(없음)'}</td>
                        <td className="px-3 py-1.5 text-center text-gray-300">→</td>
                        <td className="px-3 py-1.5 text-green-600 font-medium">{log.new_value || '(없음)'}</td>
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
          onSave={() => { setModalOpen(false); fetchAssignments(); }}
        />
      )}
    </div>
  );
}
