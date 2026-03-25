import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

export async function POST(request: NextRequest) {
  // 관리자 인증 확인
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { email, new_password } = await request.json();

  if (!email || !new_password) {
    return NextResponse.json({ error: '이메일과 새 비밀번호가 필요합니다.' }, { status: 400 });
  }

  // 이메일로 사용자 찾기
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users?.find(u => u.email === email);

  if (!user) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: new_password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
