import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

// 필드 한글 매핑
const FIELD_LABELS: Record<string, string> = {
  main_writer_id: '사수',
  sub_writer_id: '부사수',
  optimal_writer_id: '최적배포',
  inbl_writer_id: '인블',
  main_quantity: '사수 수량',
  sub_quantity: '부사수 수량',
  optimal_quantity: '최적배포 수량',
  inbl_quantity: '인블 수량',
  renewal_day: '갱신일',
  status: '상태',
  note: '비고',
  main_writer_name: '사수(이름)',
  sub_writer_name: '부사수(이름)',
  optimal_writer_name: '최적배포(이름)',
  inbl_writer_name: '인블(이름)',
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { assignment_id, updates, changed_by } = await request.json();

  if (!assignment_id || !updates || Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '필수 값이 없습니다.' }, { status: 400 });
  }

  // 현재 값 조회
  const { data: current } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignment_id)
    .single();

  if (!current) {
    return NextResponse.json({ error: '배정을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 변경 로그 생성 (실제로 값이 바뀐 필드만)
  const logs: { assignment_id: string; field_changed: string; old_value: string; new_value: string; changed_by: string | null }[] = [];

  for (const [field, newValue] of Object.entries(updates)) {
    const oldValue = current[field as keyof typeof current];
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      // 담당자 ID 변경 시 이름도 함께 기록
      let oldDisplay = String(oldValue ?? '');
      let newDisplay = String(newValue ?? '');

      if (field.endsWith('_writer_id')) {
        const nameField = field.replace('_id', '_name');
        const oldName = current[nameField as keyof typeof current];
        const newName = updates[nameField];
        if (oldName) oldDisplay = String(oldName);
        if (newName) newDisplay = String(newName);
      }

      // _name 필드는 별도 로그 생성하지 않음 (_id 로그에 포함됨)
      if (field.endsWith('_writer_name')) continue;

      logs.push({
        assignment_id,
        field_changed: FIELD_LABELS[field] || field,
        old_value: oldDisplay,
        new_value: newDisplay,
        changed_by: changed_by || null,
      });
    }
  }

  // 업데이트 실행
  const { error: updateError } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', assignment_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // 로그 저장
  if (logs.length > 0) {
    await supabase.from('assignment_logs').insert(logs);
  }

  return NextResponse.json({ success: true, logs_created: logs.length });
}
