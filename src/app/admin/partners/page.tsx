'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import type { Partner, PartnerType } from '@/types/database';
import { Plus, Trash2, X, Edit3, Search } from 'lucide-react';

function PartnerModal({ partner, onClose, onSave, onDelete }: {
  partner: Partner | null;
  onClose: () => void;
  onSave: (data: Partial<Partner>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: partner?.name || '',
    partner_type: (partner?.partner_type || 'student') as PartnerType,
    kakao_id: partner?.kakao_id || '',
    kakao_link: partner?.kakao_link || '',
    memo: partner?.memo || '',
    is_active: partner?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{partner ? '협력사 수정' : '신규 협력사 등록'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">이름 *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="예: 최송이, 바이오애드랩" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">분류 *</label>
            <select value={form.partner_type} onChange={e => setForm({...form, partner_type: e.target.value as PartnerType})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="student">수강생</option>
              <option value="agency">대행사</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">카카오톡 ID</label>
            <input value={form.kakao_id} onChange={e => setForm({...form, kakao_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">카카오톡 단톡방 링크</label>
            <input value={form.kakao_link} onChange={e => setForm({...form, kakao_link: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://open.kakao.com/..." />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">메모</label>
            <textarea value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
            <label htmlFor="is_active" className="text-sm text-gray-700">활성</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{partner ? '저장' : '등록'}</button>
            {partner && onDelete && (
              <button type="button" onClick={() => { if (confirm('이 협력사를 삭제하시겠습니까?')) onDelete(partner.id); }} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm">삭제</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'student' | 'agency'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Partner | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/partners');
      const data = await res.json();
      setPartners(data.partners || []);
    } catch {
      setPartners([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (data: Partial<Partner>) => {
    if (selected) {
      await authFetch('/api/partners', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...data }) });
    } else {
      await authFetch('/api/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    setSelected(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await authFetch(`/api/partners?id=${id}`, { method: 'DELETE' });
    setSelected(null);
    fetchData();
  };

  let filtered = filter === 'all' ? partners : partners.filter(p => p.partner_type === filter);
  if (search) filtered = filtered.filter(p => p.name.includes(search) || p.kakao_id?.includes(search));

  const studentCount = partners.filter(p => p.partner_type === 'student').length;
  const agencyCount = partners.filter(p => p.partner_type === 'agency').length;

  return (
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">협력사 관리</h2>
          <p className="text-xs text-gray-500 mt-0.5">총 {partners.length}명 (수강생 {studentCount} / 대행사 {agencyCount})</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> 협력사 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="flex gap-1">
          {(['all', 'student', 'agency'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'all' ? '전체' : f === 'student' ? '수강생' : '대행사'}
              <span className="ml-0.5 opacity-70">{f === 'all' ? partners.length : f === 'student' ? studentCount : agencyCount}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색" className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-40" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs">이름</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs w-20">분류</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">카카오톡 ID</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">단톡방</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs w-16">상태</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs w-16">편집</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">해당하는 협력사가 없습니다.</td></tr>
              ) : filtered.map((p, idx) => (
                <tr key={p.id} className={`border-b border-gray-50 hover:bg-blue-50/30 ${idx % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-4 py-2 font-medium text-gray-900">{p.name}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${p.partner_type === 'student' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.partner_type === 'student' ? '수강생' : '대행사'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{p.kakao_id || <span className="text-gray-300">-</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.kakao_link ? (
                      <a href={p.kakao_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-[200px]">{p.kakao_link}</a>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setSelected(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit3 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(selected || showAdd) && (
        <PartnerModal
          partner={selected}
          onClose={() => { setSelected(null); setShowAdd(false); }}
          onSave={handleSave}
          onDelete={selected ? handleDelete : undefined}
        />
      )}
    </div>
  );
}
