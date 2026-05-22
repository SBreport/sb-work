import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// 서버사이드 별칭 해석 (환경변수: ADMIN_ALIASES=admin:email1,manager:email2)
function getAliases(): Record<string, string> {
  const raw = process.env.ADMIN_ALIASES || '';
  const aliases: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [key, value] = pair.split(':');
    if (key && value) aliases[key.trim().toLowerCase()] = value.trim().toLowerCase();
  }
  return aliases;
}

function resolveEmail(input: string): string {
  const lower = input.trim().toLowerCase();
  const aliases = getAliases();
  if (aliases[lower]) return aliases[lower];
  if (!lower.includes('@')) return `${lower}@gmail.com`;
  return lower;
}

// ID(이메일/별칭) 검증
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { id, email: legacyEmail } = await request.json();

  // id 필드 우선, 하위 호환으로 email 필드도 지원
  const rawId = id || '';
  const email = rawId ? resolveEmail(rawId) : (legacyEmail || '').toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
  }

  // 관리자 별칭인 경우 프로필 조회 스킵
  const aliases = getAliases();
  const isAlias = rawId && aliases[rawId.trim().toLowerCase()];

  if (isAlias) {
    return NextResponse.json({ success: true, email });
  }

  // profiles 테이블에서 이메일로 계정 확인
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, is_active')
    .eq('email', email)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: '등록되지 않은 이메일입니다.' }, { status: 401 });
  }

  if (!profile.is_active) {
    return NextResponse.json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, { status: 403 });
  }

  return NextResponse.json({ success: true, email: profile.email });
}
