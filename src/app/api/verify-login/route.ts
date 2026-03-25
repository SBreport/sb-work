import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// 이름 + 이메일 매칭 검증
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { name, email } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: '이름과 이메일을 입력해주세요.' }, { status: 400 });
  }

  // profiles 테이블에서 이름+이메일 매칭 확인
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, is_active')
    .eq('email', email.toLowerCase().trim())
    .eq('name', name.trim())
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: '이름 또는 이메일이 올바르지 않습니다.' }, { status: 401 });
  }

  if (!profile.is_active) {
    return NextResponse.json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, { status: 403 });
  }

  return NextResponse.json({ success: true, email: profile.email });
}
