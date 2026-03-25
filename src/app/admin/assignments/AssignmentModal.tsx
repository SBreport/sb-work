'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Assignment, User, Branch } from '@/types/database';
import { X } from 'lucide-react';

interface Props {
  assignment: Assignment | null;
  month: string;
  writers: User[];
  onClose: () => void;
  onSave: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: '활성' },
  { value: 'new', label: '신규' },
  { value: 'changed', label: '변경' },
  { value: 'terminated', label: '해지' },
  { value: 'ai', label: 'AI' },
  { value: 'both', label: '사수부사수동시' },
];

export default function AssignmentModal({ assignment, month, writers, onClose, onSave }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({
    branch_id: assignment?.branch_id || '',
    renewal_day: assignment?.renewal_day || 1,
    main_writer_id: assignment?.main_writer_id || '',
    sub_writer_id: assignment?.sub_writer_id || '',
    optimal_writer_id: assignment?.optimal_writer_id || '',
    inbl_writer_id: assignment?.inbl_writer_id || '',
    main_quantity: assignment?.main_quantity || 4,
    sub_quantity: assignment?.sub_quantity || 11,
    optimal_quantity: assignment?.optimal_quantity || 0,
    inbl_quantity: assignment?.inbl_quantity || 0,
    status: assignment?.status || 'active',
    main_note: assignment?.main_note || '',
    sub_note: assignment?.sub_note || '',
    optimal_note: assignment?.optimal_note || '',
    inbl_note: assignment?.inbl_note || '',
    note: assignment?.note || '',
    product_type: assignment?.product_type || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('branches')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => setBranches(data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      month,
      main_writer_id: form.main_writer_id || null,
      sub_writer_id: form.sub_writer_id || null,
      optimal_writer_id: form.optimal_writer_id || null,
      inbl_writer_id: form.inbl_writer_id || null,
      product_type: form.product_type || null,
      main_note: form.main_note || null,
      sub_note: form.sub_note || null,
      optimal_note: form.optimal_note || null,
      inbl_note: form.inbl_note || null,
      note: form.note || null,
    };

    if (assignment) {
      await supabase.from('assignments').update(payload).eq('id', assignment.id);
    } else {
      await supabase.from('assignments').insert(payload);
    }

    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            {assignment ? '배정 수정' : '새 배정 추가'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 지점 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">지점</label>
            <select
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value="">지점 선택</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.category}] {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 갱신일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">갱신일</label>
              <input
                type="number"
                min={1}
                max={31}
                value={form.renewal_day}
                onChange={(e) => setForm({ ...form, renewal_day: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Assignment['status'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 사수 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사수</label>
              <select
                value={form.main_writer_id}
                onChange={(e) => setForm({ ...form, main_writer_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">미배정</option>
                {writers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사수 수량</label>
              <input
                type="number"
                min={0}
                value={form.main_quantity}
                onChange={(e) => setForm({ ...form, main_quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 부사수 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부사수</label>
              <select
                value={form.sub_writer_id}
                onChange={(e) => setForm({ ...form, sub_writer_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">미배정</option>
                {writers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부사수 수량</label>
              <input
                type="number"
                min={0}
                value={form.sub_quantity}
                onChange={(e) => setForm({ ...form, sub_quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 최적배포 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최적배포</label>
              <select
                value={form.optimal_writer_id}
                onChange={(e) => setForm({ ...form, optimal_writer_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">미배정</option>
                {writers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최적배포 수량</label>
              <input
                type="number"
                min={0}
                value={form.optimal_quantity}
                onChange={(e) => setForm({ ...form, optimal_quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 인블 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">인블</label>
              <select
                value={form.inbl_writer_id}
                onChange={(e) => setForm({ ...form, inbl_writer_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">미배정</option>
                {writers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">인블 수량</label>
              <input
                type="number"
                min={0}
                value={form.inbl_quantity}
                onChange={(e) => setForm({ ...form, inbl_quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 상품 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상품 유형</label>
            <input
              type="text"
              value={form.product_type}
              onChange={(e) => setForm({ ...form, product_type: e.target.value })}
              placeholder="솔루션, 로컬 등"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <input
              type="text"
              value={form.note || ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : (assignment ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
