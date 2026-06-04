import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/lib/auth-guard';
import { importCsvForMonth, parseCSV, cleanStr } from '@/lib/csv-import';

/** URL에서 spreadsheet ID + gid 추출 후 CSV export URL 반환 */
function buildCsvExportUrl(rawUrl: string): string | null {
  // 최소 유효성: docs.google.com/spreadsheets/d/<ID> 패턴
  const idMatch = rawUrl.match(/docs\.google\.com\/spreadsheets\/d\/([^/\s?#]+)/);
  if (!idMatch) return null;

  const id = idMatch[1];
  const gidMatch = rawUrl.match(/[?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : null;

  let url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  if (gid) url += `&gid=${gid}`;
  return url;
}

/** CSV 첫 데이터 행 A열에서 "N월" 숫자 + 연도로 YYYY-MM 추출 */
function detectMonthFromCsv(csvText: string): { month: string; monthLabel: string } | null {
  const rows = parseCSV(csvText);
  // 헤더(index 0) 다음부터 A열이 비어있지 않은 첫 행을 찾는다
  for (let i = 1; i < rows.length; i++) {
    const cell = cleanStr(rows[i][0]);
    if (!cell) continue;
    // "6월", "06월", "2026-06" 등 여러 형식 지원
    const monthNumMatch = cell.match(/^(\d{1,2})월$/);
    if (monthNumMatch) {
      const m = Number(monthNumMatch[1]);
      const year = new Date().getFullYear();
      const month = `${year}-${String(m).padStart(2, '0')}`;
      return { month, monthLabel: `${m}월` };
    }
    // "YYYY-MM" 형식
    const fullMatch = cell.match(/^(\d{4})-(\d{1,2})$/);
    if (fullMatch) {
      const m = Number(fullMatch[2]);
      const month = `${fullMatch[1]}-${String(m).padStart(2, '0')}`;
      return { month, monthLabel: `${m}월` };
    }
  }
  return null;
}

/** GET: 저장된 시트 설정 반환 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('sheet_import_config')
    .select('url, last_imported_month, last_imported_at')
    .eq('id', 1)
    .maybeSingle();

  return NextResponse.json({
    url: data?.url ?? null,
    lastImportedMonth: data?.last_imported_month ?? null,
    lastImportedAt: data?.last_imported_at ?? null,
  });
}

/** POST: { url, mode: 'detect' | 'import' } */
export async function POST(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as { url?: string; mode?: string };
  const { url, mode } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL이 없습니다.' }, { status: 400 });
  }

  const exportUrl = buildCsvExportUrl(url);
  if (!exportUrl) {
    return NextResponse.json(
      { error: '올바른 구글 시트 URL이 아닙니다. (docs.google.com/spreadsheets/d/... 형식)' },
      { status: 400 },
    );
  }

  // CSV fetch
  let csvText: string;
  try {
    const fetchRes = await fetch(exportUrl);
    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `구글 시트를 가져오지 못했습니다. (HTTP ${fetchRes.status}) 시트가 "링크 있는 사용자 - 뷰어" 권한인지 확인하세요.` },
        { status: 502 },
      );
    }
    csvText = await fetchRes.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `네트워크 오류: ${msg}` }, { status: 502 });
  }

  // 월 감지
  const detected = detectMonthFromCsv(csvText);
  if (!detected) {
    return NextResponse.json(
      { error: 'CSV 첫 데이터 행에서 월(예: "6월")을 인식할 수 없습니다.' },
      { status: 400 },
    );
  }

  if (mode === 'detect') {
    return NextResponse.json({ month: detected.month, monthLabel: detected.monthLabel });
  }

  if (mode === 'import') {
    const supabase = createServerSupabase();

    let result;
    try {
      result = await importCsvForMonth(supabase, csvText, detected.month);
    } catch (err) {
      const message = err instanceof Error ? err.message : '가져오기 실패';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // sheet_import_config 갱신
    await supabase.from('sheet_import_config').upsert({
      id: 1,
      url,
      last_imported_month: detected.month,
      last_imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json({ error: 'mode는 detect 또는 import여야 합니다.' }, { status: 400 });
}

/** DELETE: 저장된 URL 초기화 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  await supabase
    .from('sheet_import_config')
    .update({
      url: null,
      last_imported_month: null,
      last_imported_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  return NextResponse.json({ success: true });
}
