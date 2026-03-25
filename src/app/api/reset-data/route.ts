import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  if (month) {
    // 월별 초기화: 해당 월 배정만 삭제
    const { error } = await supabase.from('assignments').delete().eq('month', month);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, type: 'month', month });
  }

  // 전체 초기화
  await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('cost_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('monthly_issues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('branches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  return NextResponse.json({ success: true, type: 'all' });
}
