'use client';

import { useState } from 'react';
import { authFetch } from '@/lib/api-client';
import type { User } from '@/types/database';
import { X } from 'lucide-react';

interface Props {
  writer: User;
  onClose: () => void;
  onSave: () => void;
}

export default function WriterEditModal({ writer, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: writer.name,
    phone: writer.phone || '',
    contract_type: writer.contract_type || 'freelancer',
    is_active: writer.is_active,
    contract_start: writer.contract_start || '',
    contract_end: writer.contract_end || '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    const res = await authFetch('/api/writers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: writer.id,
        name: form.name,
        phone: form.phone,
        contract_type: form.contract_type,
        is_active: form.is_active,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        reset_password: newPassword || undefined,
      }),
    });

    if (res.ok) {
      onSave();
    } else {
      const data = await res.json();
      setMessage(data.error || '저장 실패');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`"${writer.name}" 담당자를 삭제하시겠습니까?\n해당 담당자의 배정은 "미배정"으로 변경됩니다.`)) return;
    const res = await authFetch(`/api/writers?id=${writer.id}`, { method: 'DELETE' });
    if (res.ok) {
      onSave();
    } else {
      const data = await res.json();
      setMessage(data.error || '삭제 실패');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">담당자 정보 수정</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 이메일 (읽기전용) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={writer.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
            />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 계약형태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계약형태</label>
              <select
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value as 'freelancer' | 'business' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="freelancer">프리랜서</option>
                <option value="business">개인사업자</option>
              </select>
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 계약 시작일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계약 시작일</label>
              <input
                type="date"
                value={form.contract_start}
                onChange={(e) => setForm({ ...form, contract_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* 계약 종료일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계약 종료일</label>
              <input
                type="date"
                value={form.contract_end}
                onChange={(e) => setForm({ ...form, contract_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 비밀번호 초기화 */}
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 변경</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="비워두면 변경하지 않음"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">최소 6자 이상. 비워두면 기존 비밀번호 유지.</p>
          </div>

          {message && <p className="text-red-500 text-sm">{message}</p>}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            담당자 삭제
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
