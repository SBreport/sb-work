import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/lib/auth-guard';

/**
 * 시트 컬럼 구조 (2026.04 기준):
 * A: 갱신월 (4월)
 * B: 갱신일 (1일, 10일, 19일, 20일)
 * C: 과목/병원명 → 분류 태그 (피부과 유앤아이, 성형외과 로컬 등)
 * D: 지점명 → 실제 단위 (유앤아이 광명 등)
 * E: 사수 이름
 * F: 사수 비고
 * G: 사수 수량
 * H: 부사수 이름
 * I: 부사수 비고
 * J: 부사수 수량
 * K: 최적배포 담당자 (있는 지점만)
 * L: 최적배포 수량
 * M: 최적배포 비고
 * N~ : P 이후는 미구현 (요약/인건비 등)
 */

interface ParsedRow {
  renewalMonth: string;
  renewalDay: number;
  category: string;      // 과목 (피부과, 내과 등)
  productType: string;   // 유형 (유앤아이, 로컬, 솔루션 등)
  branchName: string;    // 지점명 (유앤아이 광명 등)
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
}

function cleanStr(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^"+|"+$/g, '').replace(/,+$/, '').trim();
}

function cleanNum(val: string | undefined): number {
  if (!val) return 0;
  const n = Number(val.trim().replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseRenewalDay(val: string | undefined): number {
  const str = cleanStr(val);
  const match = str.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

function parseCategoryTag(raw: string): { category: string; productType: string } {
  // "피부과 유앤아이" → category: "피부과", productType: "유앤아이"
  // "성형외과 로컬" → category: "성형외과", productType: "로컬"
  // "피부과 솔루션" → category: "피부과", productType: "솔루션"
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return { category: parts[0], productType: parts.slice(1).join(' ') };
  }
  return { category: trimmed, productType: '' };
}

function parseCSV(text: string): string[][] {
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

function detectColumnLayout(headerRow: string[]): 'merged' | 'split' {
  // 헤더에서 "과목"과 "병원명"이 별도 컬럼인지 확인
  // 병합 셀(merged): cols[2]="과목/병원명", cols[3]="지점명" → 총 컬럼 적음
  // 분리(split): cols[2]="과목", cols[3]="병원명", cols[4]="지점명" → 컬럼 1개 더 많음
  const headers = headerRow.map(h => cleanStr(h));

  // 방법1: 헤더에서 "지점" 위치 확인
  const branchIdx = headers.findIndex(h => h.includes('지점'));
  if (branchIdx === 4) return 'split';  // C=과목, D=병원명, E=지점명
  if (branchIdx === 3) return 'merged'; // C=과목/병원명, D=지점명

  // 방법2: 헤더에서 "병원" 단독 컬럼 존재 확인
  if (headers.some((h, i) => i === 3 && (h.includes('병원') || h === '유형'))) return 'split';

  // 방법3: 데이터 패턴으로 판단 — cols[3]이 짧은 키워드(유앤아이/로컬/솔루션)면 split
  const col3 = cleanStr(headerRow[3]);
  const shortKeywords = ['유앤아이', '로컬', '솔루션', '병원명', '유형'];
  if (shortKeywords.some(k => col3.includes(k))) return 'split';

  // 기본값: split (구글 시트 CSV는 병합 셀이 분리됨)
  return 'split';
}

function parseCSVRows(csvText: string): ParsedRow[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const parsed: ParsedRow[] = [];
  const layout = detectColumnLayout(allRows[0]);

  // 컬럼 오프셋: split이면 D=병원명이 추가되어 1칸씩 밀림
  const offset = layout === 'split' ? 1 : 0;

  for (let i = 1; i < allRows.length; i++) {
    const cols = allRows[i];

    const renewalMonth = cleanStr(cols[0]);
    const branchName = cleanStr(cols[3 + offset]);

    // 데이터 행만 (갱신월이 있고, 지점명이 있는 행)
    if (!renewalMonth || !branchName) continue;

    let category: string;
    let productType: string;

    if (layout === 'split') {
      // C=과목, D=병원명/유형
      category = cleanStr(cols[2]);
      productType = cleanStr(cols[3]);
    } else {
      // C="과목 병원명" 합쳐진 형태
      const tag = parseCategoryTag(cleanStr(cols[2]));
      category = tag.category;
      productType = tag.productType;
    }

    parsed.push({
      renewalMonth,
      renewalDay: parseRenewalDay(cols[1]),
      category,
      productType,
      branchName,
      mainWriter: cleanStr(cols[4 + offset]),
      mainNote: cleanStr(cols[5 + offset]),
      mainQuantity: cleanNum(cols[6 + offset]),
      subWriter: cleanStr(cols[7 + offset]),
      subNote: cleanStr(cols[8 + offset]),
      subQuantity: cleanNum(cols[9 + offset]),
      optimalWriter: cleanStr(cols[10 + offset]),
      optimalQuantity: cleanNum(cols[11 + offset]),
      optimalNote: cleanStr(cols[12 + offset]),
      inblQuantity: cleanNum(cols[13 + offset]),
    });
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const action = formData.get('action') as string;
  const month = formData.get('month') as string;

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSVRows(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: '데이터가 없습니다. CSV 파일을 확인해주세요.' }, { status: 400 });
  }

  if (action === 'preview') {
    const writers = [...new Set([
      ...rows.map(r => r.mainWriter).filter(Boolean),
      ...rows.map(r => r.subWriter).filter(Boolean),
      ...rows.map(r => r.optimalWriter).filter(Boolean),
    ])];

    return NextResponse.json({
      rowCount: rows.length,
      writers,
      categories: [...new Set(rows.map(r => r.category).filter(Boolean))],
      productTypes: [...new Set(rows.map(r => r.productType).filter(Boolean))],
      sampleRows: rows.slice(0, 5).map(r => ({
        renewalDay: r.renewalDay,
        category: r.category,
        productType: r.productType,
        branchName: r.branchName,
        mainWriter: r.mainWriter,
        mainQuantity: r.mainQuantity,
        subWriter: r.subWriter,
        subQuantity: r.subQuantity,
        optimalWriter: r.optimalWriter,
        optimalQuantity: r.optimalQuantity,
        inblQuantity: r.inblQuantity,
      })),
    });
  }

  if (!month) {
    return NextResponse.json({ error: '월을 인식할 수 없습니다.' }, { status: 400 });
  }

  // === import ===
  const supabase = createServerSupabase();
  const writerNames = new Set<string>();

  // 1. 지점 등록 (중복 체크) - branches에 직접 태그 포함
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
      // 태그 업데이트
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

  // 3. 해당 월 기존 배정 삭제 후 새로 입력
  await supabase.from('assignments').delete().eq('month', month);

  const assignments = [];
  for (const row of rows) {
    const branchId = branchIdMap.get(row.branchName);
    if (!branchId) continue;

    assignments.push({
      branch_id: branchId,
      month,
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
      status: 'active' as const,
      product_type: row.productType || null,
    });
  }

  for (let i = 0; i < assignments.length; i += 50) {
    await supabase.from('assignments').insert(assignments.slice(i, i + 50));
  }

  return NextResponse.json({
    success: true,
    month,
    branches: branchIdMap.size,
    writers: [...writerNames],
    unmatchedWriters: [...writerNames].filter(n => !writerIdMap.get(n)),
    assignments: assignments.length,
  });
}
