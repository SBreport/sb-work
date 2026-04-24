'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Branch } from '@/types/database';
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Search, Edit3 } from 'lucide-react';

const CATEGORIES = ['피부과', '내과', '산부인과', '한의원', '성형외과', '정형외과', '치과', '안과', '세무법인', '기타'];
const PRODUCT_TYPES = ['유앤아이', '로컬', '솔루션', '대행'];

interface AssignmentSummary {
  id: string;
  main_writer_name: string | null;
  main_quantity: number;
  sub_writer_name: string | null;
  sub_quantity: number;
  optimal_writer_name: string | null;
  optimal_quantity: number;
  inbl_writer_name: string | null;
  inbl_quantity: number;
  renewal_day: number;
  status: string;
  note: string | null;
  operation_type?: 'unai' | 'direct' | 'solution' | 'agency' | null;
  partner_id?: string | null;
  slot?: number;
  partner?: { id: string; name: string; partner_type: 'student' | 'agency' } | null;
}

const OPERATION_LABELS: Record<string, string> = {
  unai: '유앤아이',
  direct: '직',
  solution: '솔루션',
  agency: '대행',
};

interface BranchWithAssignments extends Branch {
  assignments: AssignmentSummary[];
}

/* ── 월 선택 ── */
function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const [y, m] = month.split('-').map(Number);

  const prev = () => {
    const d = new Date(y, m - 2, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const next = () => {
    const d = new Date(y, m, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
      <span className="text-sm font-bold text-gray-900 min-w-[100px] text-center">{y}년 {m}월</span>
      <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
    </div>
  );
}

/* ── 날짜 피커 (캘린더 형식) ── */
function DatePicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

/* ── 지점 상세 모달 ── */
function BranchDetailModal({ branch, onClose, onSave, onDelete, isEditor }: {
  branch: BranchWithAssignments;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Branch>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isEditor: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: branch.name,
    category: branch.category,
    product_type: branch.product_type || '',
    status: branch.status,
    renewal_day: branch.renewal_day || '',
    start_date: branch.start_date || '',
    contract_type: branch.contract_type || '',
    memo: branch.memo || '',
  });

  const handleSave = async () => {
    await onSave(branch.id, {
      name: form.name,
      category: form.category,
      product_type: form.product_type,
      status: form.status as 'active' | 'terminated',
      renewal_day: form.renewal_day ? Number(form.renewal_day) : undefined,
      start_date: form.start_date || undefined,
      contract_type: form.contract_type || undefined,
      memo: form.memo || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{branch.name}</h3>
          <div className="flex items-center gap-1">
            {!isEditor && !editing && (
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <Edit3 size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* 기본 정보 */}
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">지점명</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">과목</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상품 유형</label>
                  <select value={form.product_type} onChange={e => setForm({...form, product_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">선택</option>
                    {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">갱신일</label>
                  <input type="number" min={1} max={31} value={form.renewal_day} onChange={e => setForm({...form, renewal_day: e.target.value})} placeholder="예: 1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상태</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value as 'active' | 'terminated'})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="active">활성</option>
                    <option value="terminated">해지</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">작업 시작일</label>
                  <DatePicker value={form.start_date} onChange={v => setForm({...form, start_date: v})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">계약 방식</label>
                  <input value={form.contract_type} onChange={e => setForm({...form, contract_type: e.target.value})} placeholder="예: 월정액, 건당" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">메모</label>
                <textarea value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">저장</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">취소</button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400">과목</span>
                  <p className="font-medium">{branch.category}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">상품 유형</span>
                  <p className="font-medium">{branch.product_type || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">갱신일</span>
                  <p className="font-medium">{branch.renewal_day ? `${branch.renewal_day}일` : '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">상태</span>
                  <p className={`font-medium ${branch.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                    {branch.status === 'active' ? '활성' : '해지'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">작업 시작일</span>
                  <p className="font-medium">{branch.start_date || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">계약 방식</span>
                  <p className="font-medium">{branch.contract_type || '-'}</p>
                </div>
              </div>
              {branch.memo && (
                <div className="text-sm">
                  <span className="text-xs text-gray-400">메모</span>
                  <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mt-1">{branch.memo}</p>
                </div>
              )}
            </>
          )}

          {/* 현재 월 배정 현황 (다중 slot 지원) */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              이번 달 배정 현황 {branch.assignments.length > 1 && `(${branch.assignments.length}개 분할)`}
            </h4>
            {branch.assignments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">이번 달 배정 내역 없음</p>
            ) : (
              <div className="space-y-2">
                {branch.assignments.map((assign, idx) => (
                  <div key={assign.id} className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                    {branch.assignments.length > 1 && (
                      <div className="flex items-center gap-2 pb-1.5 border-b border-gray-200 text-[11px] font-bold text-gray-500">
                        분할 {assign.slot ?? idx + 1}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {assign.operation_type && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-orange-100 text-orange-700 font-medium">
                          {OPERATION_LABELS[assign.operation_type] || assign.operation_type}
                        </span>
                      )}
                      {assign.partner && (
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${assign.partner.partner_type === 'student' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                          {assign.partner.partner_type === 'student' ? '수강생' : '대행사'} · {assign.partner.name}
                        </span>
                      )}
                    </div>
                    {assign.main_writer_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">사수</span>
                        <span><span className="font-medium text-gray-900">{assign.main_writer_name}</span> <span className="text-blue-600 font-bold">{assign.main_quantity}건</span></span>
                      </div>
                    )}
                    {assign.sub_writer_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">부사수</span>
                        <span><span className="font-medium text-gray-900">{assign.sub_writer_name}</span> <span className="text-green-600 font-bold">{assign.sub_quantity}건</span></span>
                      </div>
                    )}
                    {assign.optimal_writer_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">최적배포</span>
                        <span><span className="font-medium text-gray-900">{assign.optimal_writer_name}</span> <span className="text-indigo-600 font-bold">{assign.optimal_quantity}건</span></span>
                      </div>
                    )}
                    {assign.inbl_writer_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">인블</span>
                        <span><span className="font-medium text-gray-900">{assign.inbl_writer_name}</span> <span className="text-amber-600 font-bold">{assign.inbl_quantity}건</span></span>
                      </div>
                    )}
                    {assign.note && <p className="text-xs text-gray-400 pt-1 border-t border-gray-200">{assign.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 삭제 버튼 */}
          {!isEditor && !editing && (
            <div className="pt-2 border-t border-gray-100">
              <button onClick={() => { if (confirm('이 지점을 삭제하시겠습니까?')) onDelete(branch.id); }} className="w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                지점 삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 신규 지점 추가 모달 ── */
function AddBranchModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    name: '', category: '피부과', product_type: '', renewal_day: '',
    start_date: '', contract_type: '', memo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd({
      name: form.name,
      category: form.category,
      product_type: form.product_type,
      renewal_day: form.renewal_day ? Number(form.renewal_day) : null,
      start_date: form.start_date || null,
      contract_type: form.contract_type || null,
      memo: form.memo || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">새 지점 등록</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">지점명 *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="예: 유앤아이 광명" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">과목</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">상품 유형</label>
              <select value={form.product_type} onChange={e => setForm({...form, product_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">선택</option>
                {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">갱신일</label>
              <input type="number" min={1} max={31} value={form.renewal_day} onChange={e => setForm({...form, renewal_day: e.target.value})} placeholder="1~31" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">작업 시작일</label>
              <DatePicker value={form.start_date} onChange={v => setForm({...form, start_date: v})} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">계약 방식</label>
            <input value={form.contract_type} onChange={e => setForm({...form, contract_type: e.target.value})} placeholder="예: 월정액, 건당" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">메모</label>
            <textarea value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
          </div>
          <button type="submit" className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">등록</button>
        </form>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function BranchesPage() {
  const { isEditor } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [branches, setBranches] = useState<BranchWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('전체');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'terminated'>('all');
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<BranchWithAssignments | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/branches?month=${month}`);
      const data = await res.json();
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (data: Record<string, unknown>) => {
    await authFetch('/api/branches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    fetchData();
  };

  const handleSave = async (id: string, updates: Partial<Branch>) => {
    await authFetch('/api/branches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
    fetchData();
    setSelectedBranch(null);
  };

  const handleDelete = async (id: string) => {
    await authFetch(`/api/branches?id=${id}`, { method: 'DELETE' });
    setSelectedBranch(null);
    fetchData();
  };

  // 필터링
  const typeSet = new Set(branches.map(b => (b.product_type || '').trim()).filter(Boolean));
  const typeOrder = ['유앤아이', '로컬', '솔루션', '대행'];
  const tabs = ['전체', ...typeOrder.filter(t => typeSet.has(t)), ...Array.from(typeSet).filter(t => !typeOrder.includes(t)).sort()];

  let filtered = activeTab === '전체' ? branches : branches.filter(b => (b.product_type || '').trim() === activeTab);
  if (statusFilter !== 'all') filtered = filtered.filter(b => b.status === statusFilter);
  if (search) filtered = filtered.filter(b => b.name.includes(search) || b.category?.includes(search));

  const activeCount = branches.filter(b => b.status === 'active').length;
  const terminatedCount = branches.filter(b => b.status === 'terminated').length;

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">지점 현황</h2>
          <p className="text-xs text-gray-500 mt-0.5">총 {branches.length}개 (활성 {activeCount} / 해지 {terminatedCount})</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker month={month} onChange={setMonth} />
          {!isEditor && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={16} /> 지점 추가
            </button>
          )}
        </div>
      </div>

      {/* 필터 바 */}
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
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
            <option value="all">전체 상태</option>
            <option value="active">활성만</option>
            <option value="terminated">해지만</option>
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색" className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-36" />
          </div>
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
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs w-16">과목</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs w-16">유형</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs w-12">상태</th>
                <th className="px-3 py-2.5 text-center font-medium text-blue-600 text-xs w-20">사수</th>
                <th className="px-3 py-2.5 text-center font-medium text-green-600 text-xs w-20">부사수</th>
                <th className="px-3 py-2.5 text-center font-medium text-indigo-600 text-xs w-20">최적배포</th>
                <th className="px-3 py-2.5 text-center font-medium text-amber-600 text-xs w-20">인블</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">해당하는 지점이 없습니다.</td></tr>
              ) : filtered.map((b, idx) => {
                const assigns = b.assignments;
                const renderMultiCell = (getValue: (a: AssignmentSummary) => { name: string | null; qty: number }, colorClass: string) => {
                  const parts = assigns.map(a => getValue(a)).filter(v => v.name);
                  if (parts.length === 0) return <span className="text-gray-300">-</span>;
                  return (
                    <div className="space-y-0.5">
                      {parts.map((v, i) => (
                        <div key={i} className="leading-tight">
                          <span className="text-gray-700">{v.name}</span>
                          {' '}
                          <span className={`font-bold ${colorClass}`}>{v.qty}</span>
                        </div>
                      ))}
                    </div>
                  );
                };
                return (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBranch(b)}
                    className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                      {b.name}
                      {assigns.length > 1 && <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-semibold">분할 {assigns.length}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[11px]">{b.category}</span>
                    </td>
                    <td className="px-3 py-2">
                      {b.product_type ? (
                        <span className="inline-block px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[11px]">{b.product_type}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {b.status === 'active' ? '활성' : '해지'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {renderMultiCell(a => ({ name: a.main_writer_name, qty: a.main_quantity }), 'text-blue-600')}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {renderMultiCell(a => ({ name: a.sub_writer_name, qty: a.sub_quantity }), 'text-green-600')}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {renderMultiCell(a => ({ name: a.optimal_writer_name, qty: a.optimal_quantity }), 'text-indigo-600')}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {renderMultiCell(a => ({ name: a.inbl_writer_name, qty: a.inbl_quantity }), 'text-amber-600')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 모달들 */}
      {selectedBranch && (
        <BranchDetailModal branch={selectedBranch} onClose={() => setSelectedBranch(null)} onSave={handleSave} onDelete={handleDelete} isEditor={isEditor} />
      )}
      {showAdd && <AddBranchModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  );
}
