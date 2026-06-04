import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/lib/auth-guard';
import { parseCSVRows, importCsvForMonth } from '@/lib/csv-import';

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
      operationTypes: [...new Set(rows.map(r => r.operationType).filter(Boolean))],
      connections: [...new Set(rows.map(r => r.connectionName).filter(Boolean))],
      sampleRows: rows.slice(0, 5).map(r => ({
        renewalDay: r.renewalDay,
        category: r.category,
        productType: r.productType,
        branchName: r.branchName,
        operationType: r.operationType,
        connection: r.connectionName,
        mainWriter: r.mainWriter,
        mainQuantity: r.mainQuantity,
        subWriter: r.subWriter,
        subQuantity: r.subQuantity,
        optimalWriter: r.optimalWriter,
        optimalQuantity: r.optimalQuantity,
        inblQuantity: r.inblQuantity,
        progressStatus: r.progressStatus,
      })),
    });
  }

  if (!month) {
    return NextResponse.json({ error: '월을 인식할 수 없습니다.' }, { status: 400 });
  }

  // === import ===
  const supabase = createServerSupabase();

  try {
    const result = await importCsvForMonth(supabase, text, month);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '가져오기 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
