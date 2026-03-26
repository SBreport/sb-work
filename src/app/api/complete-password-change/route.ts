import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // 사용자 인증 확인
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // anon key로 사용자 세션 확인
  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  // service_role로 프로필 업데이트 (RLS 우회)
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ must_change_password: false, password_skip_count: 0 })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: '프로필 업데이트 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
