import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

// profiles 테이블의 정상 이름을 auth.users의 display name에 동기화
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();

  // profiles에서 이름 목록 가져오기
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name');

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: '프로필이 없습니다.', count: 0 });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const p of profiles) {
    if (!p.name) continue;

    const { error } = await supabase.auth.admin.updateUserById(p.id, {
      user_metadata: { name: p.name, role: 'freelancer' },
    });

    if (error) {
      errors.push(`${p.name}: ${error.message}`);
    } else {
      updated++;
    }
  }

  return NextResponse.json({ updated, total: profiles.length, errors });
}
