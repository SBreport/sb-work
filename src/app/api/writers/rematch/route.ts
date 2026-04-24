import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * POST /api/writers/rematch
 * assignments의 *_writer_name과 profiles.name을 매칭하여
 * *_writer_id가 비어있는 항목을 일괄 채워준다.
 *
 * - CSV import 후 신규 직원 계정을 만들었을 때 재매칭 용도
 * - 이미 ID가 있는 행은 건드리지 않음 (안전)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();

  // 1. 모든 활성 profiles의 name → id 맵 구성
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, name')
    .neq('name', 'admin');

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  const nameToId = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.name) nameToId.set(p.name.trim(), p.id);
  }

  // 2. *_writer_id가 null인 assignments 조회
  const { data: assigns, error: aErr } = await supabase
    .from('assignments')
    .select('id, main_writer_id, main_writer_name, sub_writer_id, sub_writer_name, optimal_writer_id, optimal_writer_name, inbl_writer_id, inbl_writer_name')
    .or('main_writer_id.is.null,sub_writer_id.is.null,optimal_writer_id.is.null,inbl_writer_id.is.null');

  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  let matched = 0;
  const stillUnmatched = new Set<string>();

  // 3. 각 행에서 매칭 가능한 필드 업데이트
  for (const a of assigns || []) {
    const updates: Record<string, string> = {};

    const tryMatch = (idField: string, nameField: string, currentId: string | null, currentName: string | null) => {
      if (currentId || !currentName) return;
      const id = nameToId.get(currentName.trim());
      if (id) {
        updates[idField] = id;
        matched++;
      } else {
        stillUnmatched.add(currentName);
      }
    };

    tryMatch('main_writer_id', 'main_writer_name', a.main_writer_id, a.main_writer_name);
    tryMatch('sub_writer_id', 'sub_writer_name', a.sub_writer_id, a.sub_writer_name);
    tryMatch('optimal_writer_id', 'optimal_writer_name', a.optimal_writer_id, a.optimal_writer_name);
    tryMatch('inbl_writer_id', 'inbl_writer_name', a.inbl_writer_id, a.inbl_writer_name);

    if (Object.keys(updates).length > 0) {
      await supabase.from('assignments').update(updates).eq('id', a.id);
    }
  }

  return NextResponse.json({
    success: true,
    matched,                                   // 매칭 성공 건수
    unmatched: [...stillUnmatched],            // 여전히 매칭 안 된 이름 목록
  });
}
