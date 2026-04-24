import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

// 담당자 생성
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { name, email, phone, password, role } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: '이름과 이메일은 필수입니다.' }, { status: 400 });
  }

  // 소속 (role): employee | freelancer (기본 freelancer)
  const finalRole: 'employee' | 'freelancer' = role === 'employee' ? 'employee' : 'freelancer';
  const finalEmployeeType: 'internal' | 'freelancer' = finalRole === 'employee' ? 'internal' : 'freelancer';

  // 비밀번호: 직접 입력 > 핸드폰 뒷4자리에 sb prefix 붙여 자동 설정
  let initialPassword = password;
  if (!initialPassword && phone) {
    const digits = phone.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    if (last4.length === 4) {
      initialPassword = `sb${last4}`;
    }
  }
  if (!initialPassword || initialPassword.length < 6) {
    return NextResponse.json({ error: '비밀번호 또는 핸드폰 번호를 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { name, role: finalRole },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user) {
    // role/employee_type/phone/must_change_password 일괄 보정
    const profileUpdates: Record<string, unknown> = {
      role: finalRole,
      employee_type: finalEmployeeType,
      must_change_password: true,
    };
    if (phone) profileUpdates.phone = phone;
    await supabase.from('profiles').update(profileUpdates).eq('id', data.user.id);
  }

  return NextResponse.json({ success: true, user: data.user });
}

// 담당자 수정 (이름, 전화번호, 계약형태, 비밀번호 초기화)
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { id, name, phone, contract_type, is_active, contract_start, contract_end, reset_password, role } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
  }

  // 프로필 업데이트
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (contract_type !== undefined) updates.contract_type = contract_type;
  if (is_active !== undefined) updates.is_active = is_active;
  if (contract_start !== undefined) updates.contract_start = contract_start;
  if (contract_end !== undefined) updates.contract_end = contract_end;

  // role 변경 시 employee_type도 동기화 (employee→internal, freelancer→freelancer)
  if (role !== undefined) {
    if (role === 'employee' || role === 'freelancer') {
      updates.role = role;
      updates.employee_type = role === 'employee' ? 'internal' : 'freelancer';
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('profiles').update(updates).eq('id', id);
  }

  // 비밀번호 초기화
  if (reset_password) {
    const { error } = await supabase.auth.admin.updateUserById(id, {
      password: reset_password,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}

// 담당자 삭제
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
  }

  // 배정에서 해당 담당자 참조 해제
  await supabase.from('assignments').update({ main_writer_id: null }).eq('main_writer_id', id);
  await supabase.from('assignments').update({ sub_writer_id: null }).eq('sub_writer_id', id);
  await supabase.from('assignments').update({ optimal_writer_id: null }).eq('optimal_writer_id', id);
  await supabase.from('assignments').update({ inbl_writer_id: null }).eq('inbl_writer_id', id);

  // profiles 삭제 (auth.users는 cascade로 같이 삭제)
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
