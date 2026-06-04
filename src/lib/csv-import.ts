import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * CSV 컬럼 구조 (2026-04 새 양식, v2):
 * A: 갱신월 / B: 갱신일 / C: 과목/병원명 / D: 지점명
 * E: 사수 / F: 사수 비고 / G: 사수 수량
 * H: 부사수 / I: 부사수 비고 / J: 부사수 수량
 * K: 최적배포 / L: 수량  (← 최적배포 비고 컬럼 제거됨)
 * M: 인블 수량
 * N: 구분 (유앤아이/직/솔루션/대행) ⬅ 신규
 * O: 연결 (수강생/대행사 이름) ⬅ 신규
 * P: 진행여부 ⬅ 위치 이동
 * S~: 관리자 기록용 (무시)
 *
 * 구 양식(v1):
 * K: 최적배포 / L: 수량 / M: 최적배포 비고 / N: 인블 / O: 진행여부
 */

export interface ParsedRow {
  renewalMonth: string;
  renewalDay: number;
  category: string;
  productType: string;
  branchName: string;       // "/" 및 "(숫자)" 정규화 이후의 순수 지점명
  partnerName: string;      // D열에서 분리된 수강생 이름 (있으면)
  mainWriter: string;
  mainNote: string;
  mainQuantity: number;
  subWriter: string;
  subNote: string;
  subQuantity: number;
  optimalWriter: string;
  optimalQuantity: number;
  optimalNote: string;
  inblQuantity: number;
  operationType: string;    // 구분
  connectionName: string;   // 연결 (수강생/대행사 원본 이름)
  progressStatus: string;   // 진행여부
}

export interface ImportResult {
  month: string;
  branches: number;
  writers: string[];
  unmatchedWriters: string[];
  partners: number;
  assignments: number;
}

export function cleanStr(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^"+|"+$/g, '').replace(/,+$/, '').trim();
}

export function cleanNum(val: string | undefined): number {
  if (!val) return 0;
  const n = Number(val.trim().replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function parseRenewalDay(val: string | undefined): number {
  const str = cleanStr(val);
  const match = str.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

export function parseCategoryTag(raw: string): { category: string; productType: string } {
  const trimmed = raw.trim();
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return { category: parts[0], productType: parts.slice(1).join(' ') };
  }
  return { category: trimmed, productType: '' };
}

/**
 * 지점명 정규화
 * - "로렐의원 / 최송이 수강생" → branch="로렐의원", partner="최송이"
 * - "두청한의원 (1)" → branch="두청한의원" (slot 자동 할당은 import에서)
 * - "참조은+참조은nb" → 그대로 유지
 */
export function normalizeBranchName(raw: string): { branchName: string; partnerName: string } {
  let name = raw.trim();
  let partner = '';

  // "/XX 수강생" 패턴 분리 (수강생 키워드 있을 때만)
  const slashMatch = name.match(/^(.+?)\s*\/\s*(.+?)\s*수강생\s*$/);
  if (slashMatch) {
    name = slashMatch[1].trim();
    partner = slashMatch[2].trim();
  }

  // "(숫자)" 패턴 제거 (slot 할당용)
  name = name.replace(/\s*\(\d+\)\s*$/, '').trim();

  return { branchName: name, partnerName: partner };
}

export function parseOperationType(raw: string): string {
  const v = cleanStr(raw);
  const map: Record<string, string> = {
    '유앤아이': 'unai',
    '직': 'direct',
    '솔루션': 'solution',
    '대행': 'agency',
  };
  return map[v] || '';
}

export function parseConnection(raw: string): { name: string; type: 'student' | 'agency' | null } {
  const v = cleanStr(raw);
  if (!v || v === '-') return { name: '', type: null };

  // "XX(수강생)" 또는 "XX 수강생" 형태
  const studentMatch = v.match(/^(.+?)\s*[\(（]\s*수강생\s*[\)）]\s*$/) || v.match(/^(.+?)\s+수강생\s*$/);
  if (studentMatch) return { name: studentMatch[1].trim(), type: 'student' };

  // 그 외는 대행사로 간주
  return { name: v, type: 'agency' };
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current);
        current = '';
        if (row.some(cell => cell.trim())) rows.push(row);
        row = [];
        if (char === '\r') i++;
      } else {
        current += char;
      }
    }
  }
  row.push(current);
  if (row.some(cell => cell.trim())) rows.push(row);

  return rows;
}

/**
 * 헤더를 보고 새 양식(v2)인지 구 양식(v1)인지 판별
 * - v2: 헤더에 "구분" 있음 (N열 근처)
 */
export function detectFormat(headerRow: string[]): 'v1' | 'v2' {
  const headers = headerRow.map(h => cleanStr(h));
  if (headers.some(h => h === '구분')) return 'v2';
  return 'v1';
}

export function parseCSVRows(csvText: string): ParsedRow[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const parsed: ParsedRow[] = [];
  const format = detectFormat(allRows[0]);

  for (let i = 1; i < allRows.length; i++) {
    const cols = allRows[i];

    const renewalMonth = cleanStr(cols[0]);
    const rawBranchName = cleanStr(cols[3]);

    if (!renewalMonth || !rawBranchName) continue;

    const { branchName, partnerName: partnerFromName } = normalizeBranchName(rawBranchName);

    const tag = parseCategoryTag(cleanStr(cols[2]));

    let inblQuantity = 0;
    let operationType = '';
    let connectionName = '';
    let progressStatus = '';
    let optimalNote = '';

    if (format === 'v2') {
      // K(10)=최적배포, L(11)=수량, M(12)=인블, N(13)=구분, O(14)=연결, P(15)=진행여부
      inblQuantity = cleanNum(cols[12]);
      operationType = parseOperationType(cols[13] || '');
      connectionName = cleanStr(cols[14] || '');
      progressStatus = cleanStr(cols[15] || '');
    } else {
      // v1: K(10)=최적배포, L(11)=수량, M(12)=최적배포 비고, N(13)=인블, O(14)=진행여부
      optimalNote = cleanStr(cols[12]);
      inblQuantity = cleanNum(cols[13]);
      progressStatus = cleanStr(cols[14] || '');
    }

    // D열에서 분리된 수강생 이름이 있으면 연결로 사용 (O열이 비어있을 때)
    const finalConnection = connectionName || (partnerFromName ? `${partnerFromName} (수강생)` : '');

    parsed.push({
      renewalMonth,
      renewalDay: parseRenewalDay(cols[1]),
      category: tag.category,
      productType: tag.productType,
      branchName,
      partnerName: partnerFromName,
      mainWriter: cleanStr(cols[4]),
      mainNote: cleanStr(cols[5]),
      mainQuantity: cleanNum(cols[6]),
      subWriter: cleanStr(cols[7]),
      subNote: cleanStr(cols[8]),
      subQuantity: cleanNum(cols[9]),
      optimalWriter: cleanStr(cols[10]),
      optimalQuantity: cleanNum(cols[11]),
      optimalNote,
      inblQuantity,
      operationType,
      connectionName: finalConnection,
      progressStatus,
    });
  }

  return parsed;
}

// progressStatus → AssignmentStatus 매핑
const statusMap: Record<string, string> = {
  '신규': 'new',
  '변경': 'changed',
  '중단': 'suspended',
  '해지': 'suspended',  // '해지'는 '중단'과 동일 처리
  '보류': 'hold',
};

export async function importCsvForMonth(
  supabase: SupabaseClient,
  csvText: string,
  month: string,
): Promise<ImportResult> {
  const rows = parseCSVRows(csvText);

  if (rows.length === 0) {
    throw new Error('데이터가 없습니다. CSV 파일을 확인해주세요.');
  }

  const writerNames = new Set<string>();

  // 1. 지점 등록 (지점명 기준 unique, (숫자)는 이미 normalize됨)
  const branchIdMap = new Map<string, string>();

  for (const row of rows) {
    const branchKey = row.branchName;
    if (branchIdMap.has(branchKey)) continue;

    if (row.mainWriter) writerNames.add(row.mainWriter);
    if (row.subWriter) writerNames.add(row.subWriter);
    if (row.optimalWriter) writerNames.add(row.optimalWriter);

    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('name', row.branchName)
      .maybeSingle();

    if (existing) {
      await supabase.from('branches').update({
        category: row.category,
        product_type: row.productType,
      }).eq('id', existing.id);
      branchIdMap.set(branchKey, existing.id);
    } else {
      const { data: created } = await supabase
        .from('branches')
        .insert({
          name: row.branchName,
          category: row.category,
          product_type: row.productType,
        })
        .select('id')
        .single();
      if (created) branchIdMap.set(branchKey, created.id);
    }
  }

  // 2. 담당자 매핑
  const writerIdMap = new Map<string, string | null>();
  for (const name of writerNames) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('name', name)
      .maybeSingle();
    writerIdMap.set(name, data?.id || null);
  }

  // 3. partners 자동 매칭 및 생성
  const partnerIdMap = new Map<string, string>(); // key: connectionName raw

  for (const row of rows) {
    if (!row.connectionName) continue;
    if (partnerIdMap.has(row.connectionName)) continue;

    const { name, type } = parseConnection(row.connectionName);
    if (!name || !type) continue;

    const { data: existing } = await supabase
      .from('partners')
      .select('id')
      .eq('name', name)
      .eq('partner_type', type)
      .maybeSingle();

    if (existing) {
      partnerIdMap.set(row.connectionName, existing.id);
    } else {
      const { data: created } = await supabase
        .from('partners')
        .insert({ name, partner_type: type, is_active: true })
        .select('id')
        .single();
      if (created) partnerIdMap.set(row.connectionName, created.id);
    }
  }

  // 4. 해당 월 기존 배정 삭제 후 새로 입력
  await supabase.from('assignments').delete().eq('month', month);

  // 5. slot 할당: 같은 branch_id + month가 반복되면 slot 증가
  const slotCounter = new Map<string, number>();
  const assignments = [];

  for (const row of rows) {
    const branchId = branchIdMap.get(row.branchName);
    if (!branchId) continue;

    const slotKey = `${branchId}::${month}`;
    const currentSlot = (slotCounter.get(slotKey) || 0) + 1;
    slotCounter.set(slotKey, currentSlot);

    const partnerId = row.connectionName ? (partnerIdMap.get(row.connectionName) || null) : null;

    assignments.push({
      branch_id: branchId,
      month,
      slot: currentSlot,
      renewal_day: row.renewalDay,
      main_writer_id: writerIdMap.get(row.mainWriter) || null,
      main_writer_name: row.mainWriter || null,
      main_quantity: row.mainQuantity,
      main_note: row.mainNote || null,
      sub_writer_id: writerIdMap.get(row.subWriter) || null,
      sub_writer_name: row.subWriter || null,
      sub_quantity: row.subQuantity,
      sub_note: row.subNote || null,
      optimal_writer_id: writerIdMap.get(row.optimalWriter) || null,
      optimal_writer_name: row.optimalWriter || null,
      optimal_quantity: row.optimalQuantity,
      optimal_note: row.optimalNote || null,
      inbl_writer_id: row.inblQuantity > 0 ? (writerIdMap.get('스마트브랜딩') || null) : null,
      inbl_writer_name: row.inblQuantity > 0 ? '스마트브랜딩' : null,
      inbl_quantity: row.inblQuantity,
      inbl_note: null,
      status: (statusMap[row.progressStatus] || 'active') as 'active' | 'new' | 'changed' | 'suspended' | 'hold',
      product_type: row.productType || null,
      operation_type: row.operationType || null,
      partner_id: partnerId,
    });
  }

  for (let i = 0; i < assignments.length; i += 50) {
    const { error: insertError } = await supabase.from('assignments').insert(assignments.slice(i, i + 50));
    if (insertError) {
      throw new Error(`배정 저장 실패 (${i + 1}~${Math.min(i + 50, assignments.length)}행): ${insertError.message}`);
    }
  }

  return {
    month,
    branches: branchIdMap.size,
    writers: [...writerNames],
    unmatchedWriters: [...writerNames].filter(n => !writerIdMap.get(n)),
    partners: partnerIdMap.size,
    assignments: assignments.length,
  };
}
