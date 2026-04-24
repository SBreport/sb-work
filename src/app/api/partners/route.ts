import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-guard';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/partners — 협력사(수강생/대행사) 목록
 * ?type=student|agency 로 필터 가능
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const supabase = createServerSupabase();
  let query = supabase.from('partners').select('*').order('name');
  if (type) query = query.eq('partner_type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { partners: data || [] },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}

/**
 * POST /api/partners — 신규 등록
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, partner_type, kakao_id, kakao_link, memo } = body;

  if (!name || !partner_type) {
    return NextResponse.json({ error: '이름과 분류가 필요합니다.' }, { status: 400 });
  }
  if (!['student', 'agency'].includes(partner_type)) {
    return NextResponse.json({ error: '분류는 student 또는 agency여야 합니다.' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('partners')
    .insert({ name, partner_type, kakao_id, kakao_link, memo, is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * PATCH /api/partners — 수정
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

  const supabase = createServerSupabase();
  const { error } = await supabase.from('partners').update(updates).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/partners — 삭제
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

  const supabase = createServerSupabase();
  const { error } = await supabase.from('partners').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
