import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/lib/auth-guard';
import { importCsvForMonth } from '@/lib/csv-import';
import { buildCsvExportUrl, detectSheetPeriod } from '@/lib/sheet-period';

/** GET: 저장된 시트 설정 반환 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('sheet_import_config')
    .select('url, last_imported_month, last_imported_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    const hint = error.code === '42P01'
      ? ' (sheet_import_config 테이블이 없습니다. migrations/20260522_sheet_import_config.sql을 Supabase에서 실행하세요.)'
      : '';
    return NextResponse.json({
      url: null,
      lastImportedMonth: null,
      lastImportedAt: null,
      error: `저장된 URL 조회 실패: ${error.message}${hint}`,
    });
  }

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

  const body = await request.json() as { url?: string; mode?: string; expectedMonth?: string };
  const { url, mode } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL이 없습니다.' }, { status: 400 });
  }

  if (mode !== 'detect' && mode !== 'import') {
    return NextResponse.json({ error: 'mode는 detect 또는 import여야 합니다.' }, { status: 400 });
  }
  let exportUrl: string;
  try { exportUrl = buildCsvExportUrl(url); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '시트 링크를 확인해주세요.' }, { status: 400 });
  }

  // CSV fetch
  let csvText: string;
  let disposition: string | null;
  try {
    const fetchRes = await fetch(exportUrl, { cache: 'no-store' });
    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `구글 시트를 가져오지 못했습니다. (HTTP ${fetchRes.status}) 시트가 "링크 있는 사용자 - 뷰어" 권한인지 확인하세요.` },
        { status: 502 },
      );
    }
    disposition = fetchRes.headers.get('content-disposition');
    csvText = await fetchRes.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `네트워크 오류: ${msg}` }, { status: 502 });
  }

  let detected: ReturnType<typeof detectSheetPeriod>;
  try { detected = detectSheetPeriod(csvText, disposition); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '시트의 연월을 확인하지 못했습니다.' }, { status: 400 });
  }

  if (mode === 'detect') {
    return NextResponse.json(detected);
  }
  if (body.expectedMonth !== detected.month) {
    return NextResponse.json({ error: '확인한 연월과 현재 시트의 연월이 다릅니다. 페이지를 새로고침한 뒤 다시 갱신해주세요.' }, { status: 409 });
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
    const { error: cfgError } = await supabase.from('sheet_import_config').upsert({
      id: 1,
      url,
      last_imported_month: detected.month,
      last_imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const warning = cfgError
      ? `URL 저장 실패(다음번 자동 불러오기 안 됨): ${cfgError.message}${cfgError.code === '42P01' ? ' — migrations/20260522_sheet_import_config.sql을 Supabase에서 실행하세요.' : ''}`
      : undefined;

    return NextResponse.json({ success: true, ...result, ...(warning && { warning }) });
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
