import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 통합 양식(v4): E 네이버 블로그 / F 비고 / G 블로그 총 수량 /
 * H SEO 컨텐츠 / I 비고 / J 수량. K~Q는 v2와 동일하다.
 *
 * 2026-11 양식(v3): 고유 헤더로 담당자 블록을 찾고 블록 내 수량/비고를 읽는다.
 * N 정보성+수량 / N 임상/논문+수량 / 비고 / 블로그 총 수량 /
 * SEO 컨텐츠+비고+수량 / 최적배포+수량 / 인블 / 구분 / 연결 / 진행여부 / 패키지
 *
 * CSV 컬럼 구조 (2026-04 양식, v2):
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
  format: 'v1' | 'v2' | 'v3' | 'v4';
  packageName: string;
  clinicalWriter: string;
  informationQuantity: number | null;
  clinicalQuantity: number | null;
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
 * 네이버 블로그 통합(v4), 유형별 배정(v3), 구분 열 양식(v2), 기존 양식(v1)을 판별
 * - v2: 헤더에 "구분" 있음 (N열 근처)
 */
const UNIFIED_MAIN_HEADERS = ['네이버 블로그', '블로그/논문&임상'];
const UNIFIED_SUB_HEADERS = ['SEO 컨텐츠', 'SEO 콘텐츠', 'SEO/정보성'];

export function detectFormat(headerRow: string[]): ParsedRow['format'] {
  const headers = headerRow.map(h => cleanStr(h));
  if (headers.some(h => UNIFIED_MAIN_HEADERS.includes(h)) || headers.includes('SEO/정보성')
    || (headers[6] === '블로그 총 수량' && headers[16] === '패키지')) return 'v4';
  if (headers.includes('N 정보성') || headers.includes('N 임상/논문')) return 'v3';
  if (headers.some(h => h === '구분')) return 'v2';
  return 'v1';
}

export function parseCSVRows(csvText: string): ParsedRow[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const parsed: ParsedRow[] = [];
  const format = detectFormat(allRows[0]);
  const headers = allRows[0].map(cleanStr);
  if (format === 'v4') {
    const expected = ['갱신월', '갱신일', '과목/병원명', '지점명', '네이버 블로그', '비고', '블로그 총 수량',
      'SEO 컨텐츠', '비고', '수량', '최적배포', '수량', '인블', '구분', '연결', '진행여부', '패키지'];
    expected.forEach((name, i) => {
      const valid = i === 4 ? UNIFIED_MAIN_HEADERS.includes(headers[i])
        : i === 7 ? UNIFIED_SUB_HEADERS.includes(headers[i]) : headers[i] === name;
      if (!valid) {
        throw new Error(`통합 양식의 ${String.fromCharCode(65 + i)}열은 '${name}'이어야 합니다.`);
      }
    });
  }
  const column = (name: string) => {
    const i = headers.indexOf(name);
    if (i < 0) throw new Error(`새 양식에 '${name}' 열이 없습니다.`);
    return i;
  };
  const infoCol = format === 'v3' ? column('N 정보성') : -1;
  const clinicalCol = format === 'v3' ? column('N 임상/논문') : -1;
  const totalCol = format === 'v3' ? column('블로그 총 수량') : -1;
  const seoCol = format === 'v3' ? column('SEO 컨텐츠') : -1;
  const optimalCol = format === 'v3' ? column('최적배포') : -1;
  if (format === 'v3') {
    for (const name of ['인블', '구분', '연결', '진행여부', '패키지']) column(name);
    for (const i of [infoCol, clinicalCol, seoCol + 1, optimalCol]) {
      if (headers[i + 1] !== '수량') throw new Error(`'${headers[i]}' 다음 수량 열을 확인해주세요.`);
    }
  }
  const quantity = (value: string | undefined, row: number): number | null => {
    if (!cleanStr(value)) return null;
    const n = Number(cleanStr(value).replace(/,/g, ''));
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${row}행: 수량은 0 이상의 정수여야 합니다.`);
    return n;
  };

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

    if (format === 'v3') {
      inblQuantity = quantity(cols[column('인블')], i + 1) ?? 0;
      operationType = parseOperationType(cols[column('구분')] || '');
      connectionName = cleanStr(cols[column('연결')]);
      progressStatus = cleanStr(cols[column('진행여부')]);
    } else if (format === 'v2' || format === 'v4') {
      // K(10)=최적배포, L(11)=수량, M(12)=인블, N(13)=구분, O(14)=연결, P(15)=진행여부
      inblQuantity = format === 'v4' ? quantity(cols[12], i + 1) ?? 0 : cleanNum(cols[12]);
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

    const mainWriter = cleanStr(cols[format === 'v3' ? infoCol : 4]);
    const packageName = cleanStr(cols[format === 'v3' ? column('패키지') : 16]);
    const clinicalWriter = format === 'v3' ? cleanStr(cols[clinicalCol]) : '';
    const informationQuantity = format === 'v3' ? quantity(cols[infoCol + 1], i + 1) : null;
    const clinicalQuantity = format === 'v3' ? quantity(cols[clinicalCol + 1], i + 1) : null;
    const mainQuantity = format === 'v3' ? quantity(cols[totalCol], i + 1)
      : format === 'v4' ? quantity(cols[6], i + 1) : cleanNum(cols[6]);
    if (format === 'v3' && packageName === '브랜딩') {
      if (mainQuantity == null) throw new Error(`${i + 1}행 ${branchName}: 블로그 총 수량이 필요합니다.`);
      const unsplit = informationQuantity == null && clinicalQuantity == null;
      if (unsplit && (mainQuantity > 0 && (!mainWriter || mainWriter !== clinicalWriter))) {
        throw new Error(`${i + 1}행 ${branchName}: 유형별 수량이 없으면 두 담당자가 같아야 합니다.`);
      }
      if (!unsplit) {
        if (informationQuantity == null || clinicalQuantity == null || informationQuantity + clinicalQuantity !== mainQuantity) {
          throw new Error(`${i + 1}행 ${branchName}: 정보형 + 임상/논문형 수량이 블로그 총 수량과 일치해야 합니다.`);
        }
        // 담당자 미정은 허용하며, 이름이 없는 수량을 다른 담당자에게 넘기지 않는다.
      }
    }

    parsed.push({
      renewalMonth,
      renewalDay: parseRenewalDay(cols[1]),
      category: tag.category,
      productType: tag.productType,
      branchName,
      partnerName: partnerFromName,
      mainWriter,
      mainNote: cleanStr(cols[format === 'v3' ? totalCol - 1 : 5]),
      mainQuantity: mainQuantity ?? 0,
      subWriter: cleanStr(cols[format === 'v3' ? seoCol : 7]),
      subNote: cleanStr(cols[format === 'v3' ? seoCol + 1 : 8]),
      subQuantity: format === 'v3' ? quantity(cols[seoCol + 2], i + 1) ?? 0
        : format === 'v4' ? quantity(cols[9], i + 1) ?? 0 : cleanNum(cols[9]),
      optimalWriter: cleanStr(cols[format === 'v3' ? optimalCol : 10]),
      optimalQuantity: format === 'v3' ? quantity(cols[optimalCol + 1], i + 1) ?? 0
        : format === 'v4' ? quantity(cols[11], i + 1) ?? 0 : cleanNum(cols[11]),
      optimalNote,
      inblQuantity,
      operationType,
      connectionName: finalConnection,
      progressStatus,
      format, packageName, clinicalWriter, informationQuantity, clinicalQuantity,
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

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 대상 월이 필요합니다.');
  if (rows.some(r => r.format === 'v3' || r.format === 'v4') && month < '2026-11') throw new Error('새 양식은 2026년 11월부터 사용할 수 있습니다.');
  for (const row of rows) {
    const m = row.renewalMonth.match(/^(?:(\d{4})-)?(\d{1,2})(?:월)?$/);
    if (!m || Number(m[2]) !== Number(month.slice(5)) || (m[1] && m[1] !== month.slice(0, 4))) {
      throw new Error('시트의 갱신월과 대상 월이 일치하지 않습니다.');
    }
  }
  // 11월 이후에는 헤더 명칭과 무관하게 패키지를 보존하고 월 교체 RPC를 사용한다.
  const useAtomicReplace = month >= '2026-11';
  if (useAtomicReplace) {
    if (rows[0].format !== 'v3' && cleanStr(parseCSV(csvText)[0]?.[16]) !== '패키지') {
      throw new Error('2026년 11월 이후 양식에는 Q열 패키지가 필요합니다. 기존 배정은 변경하지 않았습니다.');
    }
    const { error } = await supabase.from('assignments')
      .select('package_name, information_quantity, clinical_writer_id, clinical_writer_name, clinical_quantity').limit(0);
    if (error) throw new Error('새 배정 양식용 DB 마이그레이션을 먼저 적용해주세요. 기존 배정은 변경하지 않았습니다.');
  }
  const writerNames = new Set<string>();
  for (const row of rows) {
    for (const name of [row.mainWriter, row.subWriter, row.optimalWriter,
      ...(row.packageName === '브랜딩' ? [row.clinicalWriter] : [])]) {
      if (name) writerNames.add(name);
    }
  }

  // 1. 지점 등록 (지점명 기준 unique, (숫자)는 이미 normalize됨)
  const branchIdMap = new Map<string, string>();

  for (const row of rows) {
    const branchKey = row.branchName;
    if (branchIdMap.has(branchKey)) continue;

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

  // 4. 저장할 배정을 모두 구성한 뒤 월 단위로 교체한다.

  // 5. slot 할당: 같은 branch_id + month가 반복되면 slot 증가
  const slotCounter = new Map<string, number>();
  const assignments = [];

  for (const row of rows) {
    const branchId = branchIdMap.get(row.branchName);
    if (!branchId) throw new Error(`${row.branchName}: 지점 저장에 실패했습니다.`);

    const slotKey = `${branchId}::${month}`;
    const currentSlot = (slotCounter.get(slotKey) || 0) + 1;
    slotCounter.set(slotKey, currentSlot);

    const partnerId = row.connectionName ? (partnerIdMap.get(row.connectionName) || null) : null;

    assignments.push({
      ...(useAtomicReplace ? {
        package_name: row.packageName || null,
        information_quantity: row.packageName === '브랜딩' ? row.informationQuantity : null,
        clinical_writer_id: row.packageName === '브랜딩' ? writerIdMap.get(row.clinicalWriter) || null : null,
        clinical_writer_name: row.packageName === '브랜딩' ? row.clinicalWriter || null : null,
        clinical_quantity: row.packageName === '브랜딩' ? row.clinicalQuantity : null,
      } : {}),
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

  if (useAtomicReplace) {
    const { error } = await supabase.rpc('replace_month_assignments', { target_month: month, new_assignments: assignments });
    if (error) throw new Error(`배정 저장 실패: ${error.message}`);
  } else {
    const { error: deleteError } = await supabase.from('assignments').delete().eq('month', month);
    if (deleteError) throw new Error(`기존 배정 삭제 실패: ${deleteError.message}`);
    for (let i = 0; i < assignments.length; i += 50) {
      const { error } = await supabase.from('assignments').insert(assignments.slice(i, i + 50));
      if (error) throw new Error(`배정 저장 실패: ${error.message}`);
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
