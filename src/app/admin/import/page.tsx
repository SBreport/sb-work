'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { getCurrentMonth } from '@/lib/date';
import { Upload, Check, AlertCircle, Loader2, Trash2, FileText, X, RefreshCw } from 'lucide-react';

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

interface SheetImportResult {
  month: string;
  branches: number;
  writers: string[];
  unmatchedWriters: string[];
  partners: number;
  assignments: number;
}

type ImportSummary =
  | { type: 'sheet'; result: SheetImportResult }
  | { type: 'files'; doneFiles: FileItem[] };

function parseMonthFromFilename(filename: string): string | null {
  const match = filename.match(/(\d{4})\.(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ImportPage() {
  const { isEditor } = useAuth();
  const router = useRouter();

  // ── CSV 파일 상태 ──
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 구글 시트 상태 ──
  const [sheetUrl, setSheetUrl] = useState('');
  const [savedLastImportedMonth, setSavedLastImportedMonth] = useState<string | null>(null);
  const [savedLastImportedAt, setSavedLastImportedAt] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');

  // ── 공통 결과/에러 ──
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');

  // ── 초기화 상태 ──
  const [resetting, setResetting] = useState(false);
  const [deleteMonth, setDeleteMonth] = useState(getCurrentMonth());
  const [deletingMonth, setDeletingMonth] = useState(false);

  // 편집자는 이 페이지에 접근할 수 없음
  if (isEditor) {
    router.push('/admin/dashboard');
    return null;
  }

  // 마운트 시 저장된 시트 설정 로드
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    authFetch('/api/import-from-sheet')
      .then(r => r.json())
      .then((data: { url: string | null; lastImportedMonth: string | null; lastImportedAt: string | null; error?: string }) => {
        if (data.error) setSheetError(data.error);
        if (data.url) setSheetUrl(data.url);
        setSavedLastImportedMonth(data.lastImportedMonth);
        setSavedLastImportedAt(data.lastImportedAt);
      })
      .catch(() => {/* 무시 */});
  }, []);

  // ── 구글 시트 갱신 ──
  const handleSheetRefresh = async () => {
    if (!sheetUrl.trim()) {
      setSheetError('시트 URL을 입력하세요.');
      return;
    }
    setSheetError('');
    setSheetLoading(true);

    try {
      // 1) detect
      const detectRes = await authFetch('/api/import-from-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl.trim(), mode: 'detect' }),
      });
      const detectData = await detectRes.json();
      if (!detectRes.ok) {
        setSheetError(detectData.error || '월 감지 실패');
        return;
      }

      const { monthLabel: label } = detectData as { month: string; monthLabel: string };

      // 2) confirm
      const ok = confirm(`'${label}' 데이터로 인식했습니다. 갱신하시겠습니까?`);
      if (!ok) return;

      // 3) import
      const importRes = await authFetch('/api/import-from-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl.trim(), mode: 'import' }),
      });
      const importData = await importRes.json();
      if (!importRes.ok) {
        setSheetError(importData.error || '가져오기 실패');
        return;
      }

      const result = importData as SheetImportResult & { success: boolean; warning?: string };
      setSavedLastImportedMonth(result.month);
      setSavedLastImportedAt(new Date().toISOString());
      setImportSummary({ type: 'sheet', result });
      if (result.warning) {
        setSheetError(result.warning);
      }
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSheetLoading(false);
    }
  };

  // ── 시트 URL 지우기 ──
  const handleSheetClear = async () => {
    await authFetch('/api/import-from-sheet', { method: 'DELETE' });
    setSheetUrl('');
    setSavedLastImportedMonth(null);
    setSavedLastImportedAt(null);
    setSheetError('');
  };

  // ── 파일 업로드 ──
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const newFiles: FileItem[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const month = parseMonthFromFilename(f.name);
      newFiles.push({ file: f, month, status: 'pending' });
    }
    newFiles.sort((a, b) => (a.month || '').localeCompare(b.month || ''));
    setFiles(prev => [...prev, ...newFiles]);
    setError('');
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
    setImportSummary(null);

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (!item.month || item.status !== 'pending') continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'importing' } : f));

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('action', 'import');
        formData.append('month', item.month);

        const res = await authFetch('/api/import-excel', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || '가져오기 실패');

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', result: data } : f));
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

  // 파일 가져오기 완료 후 summary 자동 세팅
  const prevIsImporting = useRef(false);
  useEffect(() => {
    if (prevIsImporting.current && !isImporting) {
      const doneFiles = files.filter(f => f.status === 'done');
      if (doneFiles.length > 0) {
        setImportSummary({ type: 'files', doneFiles });
      }
    }
    prevIsImporting.current = isImporting;
  }, [isImporting, files]);

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
      <h2 className="text-lg font-bold text-gray-900 mb-1">데이터 가져오기</h2>
      <p className="text-xs text-gray-500 mb-4">
        구글 시트로 직접 갱신하거나, CSV 파일을 업로드하여 월별 데이터를 가져옵니다
      </p>

      {/* 2열 그리드: 구글 시트 | CSV 파일 */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">

        {/* 좌: 구글 시트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-0.5">구글 시트로 가져오기</h3>
            <p className="text-xs text-gray-400">링크 있는 사용자(뷰어) 권한 시트</p>
          </div>

          {/* URL 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={handleSheetRefresh}
              disabled={sheetLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              {sheetLoading
                ? <Loader2 size={13} className="animate-spin" />
                : <RefreshCw size={13} />}
              갱신
            </button>
          </div>

          {/* 에러 */}
          {sheetError && (
            <div className="flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{sheetError}</span>
            </div>
          )}

          {/* 마지막 갱신 정보 */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {savedLastImportedAt
                ? <>마지막 갱신: <span className="text-gray-600">{formatDateTime(savedLastImportedAt)}</span>
                    {savedLastImportedMonth && <span className="text-gray-500"> ({savedLastImportedMonth.replace('-', '.')})</span>}
                  </>
                : '아직 갱신한 적 없음'}
            </p>
            {sheetUrl && (
              <button
                onClick={handleSheetClear}
                className="text-xs text-gray-300 hover:text-gray-500 shrink-0 ml-2"
              >
                URL 지우기
              </button>
            )}
          </div>
        </div>

        {/* 우: CSV 파일 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-0.5">CSV 파일로 가져오기</h3>
            <p className="text-xs text-gray-400">파일명에서 월 자동 인식 · 여러 파일 동시 선택 가능</p>
          </div>

          {/* 드래그 업로드 영역 */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
          >
            <Upload size={18} className="text-gray-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-700">클릭하거나 파일을 드래그하여 업로드</p>
              <p className="text-xs text-gray-400 mt-0.5">CSV 파일만 가능</p>
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
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={13} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 파일 목록 */}
          {files.length > 0 && (
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">파일 목록 ({files.length}개)</span>
                  {doneCount > 0 && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">완료 {doneCount}</span>}
                  {errorCount > 0 && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">실패 {errorCount}</span>}
                  {invalidCount > 0 && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">인식불가 {invalidCount}</span>}
                </div>
                <button onClick={clearAllFiles} className="text-xs text-gray-400 hover:text-gray-600">전체 제거</button>
              </div>
              <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
                {files.map((item, idx) => (
                  <div key={idx} className={`px-3 py-2 flex items-center gap-2 text-xs ${
                    item.status === 'done' ? 'bg-green-50/50' :
                    item.status === 'error' ? 'bg-red-50/50' :
                    item.status === 'importing' ? 'bg-blue-50/50' : ''
                  }`}>
                    <div className="shrink-0">
                      {item.status === 'done' && <Check size={14} className="text-green-500" />}
                      {item.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                      {item.status === 'importing' && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                      {item.status === 'pending' && <FileText size={14} className="text-gray-400" />}
                    </div>
                    {item.month ? (
                      <span className={`px-1.5 py-0.5 rounded font-medium min-w-[72px] text-center ${
                        item.status === 'done' ? 'bg-green-100 text-green-700' :
                        item.status === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {monthLabel(item.month)}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium min-w-[72px] text-center">월 인식불가</span>
                    )}
                    <span className="text-gray-600 truncate flex-1">{item.file.name}</span>
                    {item.status === 'done' && item.result && (
                      <span className="text-green-600 shrink-0">{item.result.assignments}건</span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-red-500 shrink-0 truncate max-w-[80px]">{item.error}</span>
                    )}
                    {item.status === 'pending' && (
                      <button onClick={() => removeFile(idx)} className="shrink-0 text-gray-300 hover:text-gray-500">
                        <X size={12} />
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 self-start"
            >
              {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {isImporting ? '가져오는 중...' : `${pendingCount}개 파일 가져오기`}
            </button>
          )}
        </div>
      </div>

      {/* 공통 결과 영역 */}
      {importSummary && importSummary.type === 'sheet' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Check size={15} className="text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              구글 시트 갱신 완료 — {monthLabel(importSummary.result.month)}
            </p>
          </div>
          <p className="text-xs text-green-700">
            {importSummary.result.assignments}건 배정 · 지점 {importSummary.result.branches}개 · 파트너 {importSummary.result.partners}개
          </p>
          {importSummary.result.unmatchedWriters.length > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-200">
              <p className="text-xs text-amber-700 font-medium mb-1">
                미매칭 담당자 {importSummary.result.unmatchedWriters.length}명 (담당자 관리에서 추가 필요)
              </p>
              <div className="flex flex-wrap gap-1">
                {importSummary.result.unmatchedWriters.sort().map(name => (
                  <span key={name} className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {importSummary && importSummary.type === 'files' && !isImporting && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Check size={15} className="text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              {importSummary.doneFiles.length}개 파일 가져오기 완료
              {errorCount > 0 && <span className="text-red-600 ml-1">/ {errorCount}개 실패</span>}
            </p>
          </div>
          <p className="text-xs text-green-700">
            총 {importSummary.doneFiles.reduce((s, f) => s + (f.result?.assignments || 0), 0)}건 배정 등록됨
          </p>
          {(() => {
            const allUnmatched = new Set<string>();
            importSummary.doneFiles.forEach(f => {
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
      <div className="mt-6 pt-4 border-t border-gray-200">
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
