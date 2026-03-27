import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * POST /api/enforce-password-change
 * 내부 직원(employee) 전원에게 비밀번호 변경 강제 설정
 * admin/editor는 제외
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .update({ must_change_password: true, password_skip_count: 0 })
    .eq('role', 'employee')
    .eq('is_active', true)
    .select('name, email');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `${data?.length || 0}명의 직원에게 비밀번호 변경 설정 완료`,
    updated: data?.map(p => p.name),
  });
}

// 브라우저에서 쉽게 실행
export async function GET(request: NextRequest) {
  return POST(request);
}
