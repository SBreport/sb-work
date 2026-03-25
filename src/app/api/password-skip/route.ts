import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // 사용자 인증 확인 (anon key로 세션 확인)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // 사용자 세션에서 user_id 가져오기
  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  // service_role로 프로필 업데이트
  const supabase = createServerSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_skip_count')
    .eq('id', user.id)
    .single();

  const currentCount = profile?.password_skip_count || 0;

  if (currentCount >= 3) {
    return NextResponse.json({ error: '건너뛰기 횟수를 모두 사용했습니다.' }, { status: 400 });
  }

  await supabase
    .from('profiles')
    .update({ password_skip_count: currentCount + 1 })
    .eq('id', user.id);

  return NextResponse.json({ success: true, skipCount: currentCount + 1 });
}
