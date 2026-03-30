'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { getCurrentMonth } from '@/lib/date';
import { Upload, Check, AlertCircle, Loader2, Trash2, FileText, X } from 'lucide-react';

interface FileItem {
  file: File;
  month: string | null;
  status: 'pending' | 'importing' | 'done' | 'error';
  result?: {
    assignments: number;
    branches: number;
    hospitals: number;
    writers: string[];
    unmatchedWriters: string[];
  };
  error?: string;
}

function parseMonthFromFilename(filename: string): string | null {
  const match = filename.match(/(\d{4})\.(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

export default function ImportPage() {
  const { isEditor } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleteMonth, setDeleteMonth] = useState(getCurrentMonth());
  const [deletingMonth, setDeletingMonth] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 편집자는 이 페이지에 접근할 수 없음
  if (isEditor) {
    router.push('/admin/dashboard');
    return null;
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const newFiles: FileItem[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const month = parseMonthFromFilename(f.name);
      newFiles.push({ file: f, month, status: 'pending' });
    }

    // 월 기준 오름차순 정렬
    newFiles.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

    setFiles(prev => [...prev, ...newFiles]);
    setError('');

    // input 초기화 (같은 파일 재선택 가능)
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files;
    if (!dropped || dropped.length === 0) return;

    const newFiles: FileItem[] = [];
    for (let i = 0; i < dropped.length; i++) {
      const f = dropped[i];
      if (!f.name.endsWith('.csv')) continue;
      const month = parseMonthFromFilename(f.name);
      newFiles.push({ file: f, month, status: 'pending' });
    }
    newFiles.sort((a, b) => (a.month || '').localeCompare(b.month || ''));
    setFiles(prev => [...prev, ...newFiles]);
    setError('');
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setError('');
  };

  const handleImportAll = async () => {
    const validFiles = files.filter(f => f.month && f.status === 'pending');
    if (validFiles.length === 0) return;

    const invalidCount = files.filter(f => !f.month).length;
    if (invalidCount > 0) {
      if (!confirm(`${invalidCount}개 파일은 월을 인식할 수 없어 건너뜁니다. 계속하시겠습니까?`)) return;
    }

    if (!confirm(`${validFiles.length}개 파일을 순차적으로 가져옵니다.\n기존 데이터는 월별로 덮어씌워집니다. 진행하시겠습니까?`)) return;

    setIsImporting(true);

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (!item.month || item.status !== 'pending') continue;

      // 상태: importing
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'importing' } : f));

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('action', 'import');
        formData.append('month', item.month);

        const res = await authFetch('/api/import-excel', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || '가져오기 실패');

        setFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f,
          status: 'done',
          result: data,
        } : f));
      } catch (err) {
        setFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f,
          status: 'error',
          error: err instanceof Error ? err.message : '알 수 없는 오류',
        } : f));
      }
    }

    setIsImporting(false);
  };

  const pendingCount = files.filter(f => f.month && f.status === 'pending').length;
  const doneCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const invalidCount = files.filter(f => !f.month).length;

  const handleReset = async () => {
    if (!confirm('정말 모든 데이터(배정, 병원, 지점)를 초기화하시겠습니까?\n담당자 계정은 유지됩니다.')) return;
    if (!confirm('한번 더 확인합니다. 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
    setResetting(true);
    try {
      const res = await authFetch('/api/reset-data', { method: 'POST' });
      if (!res.ok) throw new Error('초기화 실패');
      setFiles([]);
      alert('데이터가 초기화되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '초기화 실패');
    }
    setResetting(false);
  };

  return (
    <div className="p-4 max-w-[1000px] mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-1">CSV 데이터 가져오기</h2>
      <p className="text-xs text-gray-500 mb-4">
        구글 시트에서 월별 탭을 CSV로 다운로드 → 여러 파일을 한번에 업로드
      </p>

      {/* 파일 업로드 영역 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors mb-3"
      >
        <Upload size={20} className="text-gray-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            클릭하거나 파일을 드래그하여 업로드
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            CSV 파일 여러 개 선택 가능 · 파일명에서 월 자동 인식
          </p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* 파일 목록 */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-700">파일 목록 ({files.length}개)</h3>
              {doneCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">완료 {doneCount}</span>
              )}
              {errorCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">실패 {errorCount}</span>
              )}
              {invalidCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">인식불가 {invalidCount}</span>
              )}
            </div>
            <button onClick={clearAllFiles} className="text-xs text-gray-400 hover:text-gray-600">
              전체 제거
            </button>
          </div>

          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {files.map((item, idx) => (
              <div key={idx} className={`px-4 py-2.5 flex items-center gap-3 text-sm ${
                item.status === 'done' ? 'bg-green-50/50' :
                item.status === 'error' ? 'bg-red-50/50' :
                item.status === 'importing' ? 'bg-blue-50/50' : ''
              }`}>
                {/* 상태 아이콘 */}
                <div className="shrink-0">
                  {item.status === 'done' && <Check size={16} className="text-green-500" />}
                  {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                  {item.status === 'importing' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                  {item.status === 'pending' && <FileText size={16} className="text-gray-400" />}
                </div>

                {/* 월 배지 */}
                {item.month ? (
                  <span className={`text-xs px-2 py-0.5 rounded font-medium min-w-[80px] text-center ${
                    item.status === 'done' ? 'bg-green-100 text-green-700' :
                    item.status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {monthLabel(item.month)}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium min-w-[80px] text-center">
                    월 인식불가
                  </span>
                )}

                {/* 파일명 */}
                <span className="text-xs text-gray-600 truncate flex-1">{item.file.name}</span>

                {/* 결과 요약 */}
                {item.status === 'done' && item.result && (
                  <div className="shrink-0 text-right">
                    <span className="text-xs text-green-600">
                      {item.result.assignments}건 배정
                    </span>
                    {item.result.unmatchedWriters.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-amber-600 font-medium">
                          미매칭 {item.result.unmatchedWriters.length}명:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5 justify-end">
                          {item.result.unmatchedWriters.map(name => (
                            <span key={name} className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {item.status === 'error' && (
                  <span className="text-xs text-red-500 shrink-0">{item.error}</span>
                )}

                {/* 삭제 버튼 (pending만) */}
                {item.status === 'pending' && (
                  <button onClick={() => removeFile(idx)} className="shrink-0 text-gray-300 hover:text-gray-500">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 가져오기 버튼 */}
      {pendingCount > 0 && (
        <button
          onClick={handleImportAll}
          disabled={isImporting}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium mb-6"
        >
          {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {isImporting ? '가져오는 중...' : `${pendingCount}개 파일 가져오기`}
        </button>
      )}

      {/* 완료 후 요약 */}
      {!isImporting && doneCount > 0 && pendingCount === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Check size={16} className="text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              {doneCount}개 파일 가져오기 완료
              {errorCount > 0 && <span className="text-red-600 ml-1">/ {errorCount}개 실패</span>}
            </p>
          </div>
          <p className="text-xs text-green-700">
            총 {files.filter(f => f.status === 'done').reduce((s, f) => s + (f.result?.assignments || 0), 0)}건 배정 등록됨
          </p>
          {(() => {
            const allUnmatched = new Set<string>();
            files.filter(f => f.status === 'done' && f.result).forEach(f => {
              f.result?.unmatchedWriters.forEach(n => allUnmatched.add(n));
            });
            if (allUnmatched.size === 0) return null;
            return (
              <div className="mt-2 pt-2 border-t border-amber-200">
                <p className="text-xs text-amber-700 font-medium mb-1">
                  미매칭 담당자 {allUnmatched.size}명 (담당자 관리에서 추가 필요)
                </p>
                <div className="flex flex-wrap gap-1">
                  {[...allUnmatched].sort().map(name => (
                    <span key={name} className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 데이터 초기화 */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">데이터 초기화</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 월별 초기화 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">월별 배정 삭제</p>
            <p className="text-xs text-gray-400 mb-3">선택한 월의 배정 데이터만 삭제</p>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={deleteMonth}
                onChange={(e) => setDeleteMonth(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1"
              />
              <button
                onClick={async () => {
                  const [y, m] = deleteMonth.split('-');
                  if (!confirm(`${y}년 ${Number(m)}월 배정 데이터를 삭제하시겠습니까?`)) return;
                  setDeletingMonth(true);
                  await authFetch(`/api/reset-data?month=${deleteMonth}`, { method: 'POST' });
                  setDeletingMonth(false);
                  alert(`${y}년 ${Number(m)}월 데이터가 삭제되었습니다.`);
                }}
                disabled={deletingMonth}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 shrink-0"
              >
                {deletingMonth ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                삭제
              </button>
            </div>
          </div>

          {/* 전체 초기화 */}
          <div className="bg-white rounded-lg border border-red-200 p-4">
            <p className="text-sm font-medium text-red-600 mb-1">전체 초기화</p>
            <p className="text-xs text-gray-400 mb-3">모든 배정/지점 삭제 (담당자 유지)</p>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {resetting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {resetting ? '초기화 중...' : '전체 데이터 초기화'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
