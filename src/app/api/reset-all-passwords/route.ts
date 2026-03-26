import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/lib/auth-guard';

// 프리랜서 전원 비밀번호를 "010010"으로 리셋
export async function POST(request: NextRequest) {
  // 관리자 인증 확인
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();

  // 프리랜서 목록 조회
  const { data: freelancers } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('role', 'freelancer');

  if (!freelancers || freelancers.length === 0) {
    return NextResponse.json({ message: '프리랜서가 없습니다.', count: 0 });
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const f of freelancers) {
    const { error } = await supabase.auth.admin.updateUserById(f.id, {
      password: '010010',
    });
    if (error) {
      failed++;
      errors.push(`${f.name}: ${error.message}`);
    } else {
      success++;
    }
  }

  // must_change_password 플래그 해제
  await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('role', 'freelancer');

  return NextResponse.json({
    message: `비밀번호 리셋 완료: ${success}명 성공, ${failed}명 실패`,
    success,
    failed,
    errors,
  });
}
