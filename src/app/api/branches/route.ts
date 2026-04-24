import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-guard';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/branches — 지점 목록 + 해당 월 배정 현황
 * ?month=2026-04 (optional, defaults to current month)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const supabase = createServerSupabase();

  const [branchesRes, assignmentsRes] = await Promise.all([
    supabase
      .from('branches')
      .select('*')
      .order('name'),
    supabase
      .from('assignments')
      .select('id, branch_id, main_writer_name, main_quantity, sub_writer_name, sub_quantity, optimal_writer_name, optimal_quantity, inbl_writer_name, inbl_quantity, renewal_day, status, note, product_type, operation_type, partner_id, slot, partner:partners(id, name, partner_type, kakao_id, kakao_link)')
      .eq('month', month)
      .order('slot', { ascending: true }),
  ]);

  if (branchesRes.error) {
    return NextResponse.json({ error: branchesRes.error.message }, { status: 500 });
  }

  // 배정 데이터를 branch_id로 맵핑
  const assignmentMap = new Map<string, typeof assignmentsRes.data>();
  for (const a of assignmentsRes.data || []) {
    const list = assignmentMap.get(a.branch_id) || [];
    list.push(a);
    assignmentMap.set(a.branch_id, list);
  }

  const branches = (branchesRes.data || []).map(b => ({
    ...b,
    assignments: assignmentMap.get(b.id) || [],
  }));

  return NextResponse.json(
    { branches, month },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}

/**
 * POST /api/branches — 신규 지점 등록
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, category, product_type, renewal_day, start_date, contract_type, memo } = body;

  if (!name) {
    return NextResponse.json({ error: '지점명이 필요합니다.' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const insert: Record<string, unknown> = { name, category, product_type, status: 'active' };
  if (renewal_day != null) insert.renewal_day = renewal_day;
  if (start_date) insert.start_date = start_date;
  if (contract_type) insert.contract_type = contract_type;
  if (memo) insert.memo = memo;

  const { data, error } = await supabase.from('branches').insert(insert).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/branches — 지점 정보 수정
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.from('branches').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/branches — 지점 삭제
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.from('branches').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
