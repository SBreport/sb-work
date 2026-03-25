import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

// 공지 목록 조회 (모든 로그인 사용자)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const adminView = searchParams.get('admin') === 'true';

  let query = supabase
    .from('notices')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (!adminView) {
    query = query.eq('is_active', true);
  }

  // 월 필터: 해당 월 공지 + 월 지정 없는 공지(항상 표시)
  if (month) {
    query = query.or(`month.eq.${month},month.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data || []);
}

// 공지 생성 (관리자만)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { title, content, month, is_pinned } = await request.json();

  if (!title || !content) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notices')
    .insert({
      title,
      content,
      month: month || null,
      is_pinned: is_pinned || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

// 공지 수정 (관리자만)
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { id, title, content, month, is_pinned, is_active } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (month !== undefined) updates.month = month || null;
  if (is_pinned !== undefined) updates.is_pinned = is_pinned;
  if (is_active !== undefined) updates.is_active = is_active;

  const { error } = await supabase.from('notices').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

// 공지 삭제 (관리자만)
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
  }

  const { error } = await supabase.from('notices').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
