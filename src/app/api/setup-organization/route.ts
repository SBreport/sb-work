import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';

// 조직도 초기 데이터 세팅 — 멱등 API (여러 번 실행 가능)
// 1) smart 테스트 계정 삭제
// 2) 신규 내부직원 auth 계정 생성
// 3) 전체 프로필 업데이트 (팀, 직위, 연락처)
// 4) 블로그팀 사수/부사수 배정
// 5) 직무대행 설정

interface NewEmployee {
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface ProfileUpdate {
  email: string;
  phone?: string;
  position?: string;
  mentor_role?: string | null;
  employee_type?: string;
  team_name?: string | null; // NULL = 경영진 (팀 미소속)
  sort_order?: number;
}

// GET도 허용 (브라우저에서 쉽게 실행하기 위해)
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const log: string[] = [];

  // ── Step 0: smart 테스트 계정 삭제 ──
  const { data: smartProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'smartbranding0@gmail.com')
    .single();

  if (smartProfile) {
    await supabase.from('profiles').delete().eq('id', smartProfile.id);
    await supabase.auth.admin.deleteUser(smartProfile.id);
    log.push('🗑️ smart 테스트 계정 삭제 완료');
  } else {
    log.push('⏩ smart 계정 — 이미 삭제됨');
  }

  // smart@gmail.com 계정도 정리
  const { data: smartProfile2 } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'smart@gmail.com')
    .single();

  if (smartProfile2) {
    await supabase.from('profiles').delete().eq('id', smartProfile2.id);
    await supabase.auth.admin.deleteUser(smartProfile2.id);
    log.push('🗑️ smart@gmail.com 계정 삭제 완료');
  }

  // ── Step 1: 신규 계정 생성 (아직 없는 내부직원) ──
  const newEmployees: NewEmployee[] = [
    { name: '신동민', email: 'twlibraryst@gmail.com', phone: '010-9722-2357', role: 'editor' },
    { name: '최형기', email: 'sbconsulting7890@gmail.com', phone: '010-2824-1794', role: 'employee' },
    { name: '이병준', email: 'leebjz2012@gmail.com', phone: '010-6669-1793', role: 'employee' },
    { name: '신준용', email: 'magimist001@gmail.com', phone: '010-8361-4938', role: 'employee' },
    { name: '김채운', email: 'cwkim5008@gmail.com', phone: '010-9703-3842', role: 'employee' },
    { name: '이다건', email: 'a41732368@gmail.com', phone: '010-4173-2368', role: 'employee' },
    { name: '김유진', email: 'lcukuj@gmail.com', phone: '010-9597-7218', role: 'employee' },
    { name: '최지원', email: 'wldhd222@gmail.com', phone: '010-6374-9318', role: 'employee' },
    { name: '조안나', email: 'vvip7404@gmail.com', phone: '010-9958-7404', role: 'employee' },
    { name: '김은지', email: 'djc486@naver.com', phone: '', role: 'employee' },
  ];

  for (const emp of newEmployees) {
    // 기존 프로필 확인
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emp.email)
      .single();

    if (existing) {
      log.push(`⏩ ${emp.name} (${emp.email}) — 이미 존재`);
      continue;
    }

    const password = emp.phone.replace(/-/g, '') || '0000000000';
    const { error } = await supabase.auth.admin.createUser({
      email: emp.email,
      password,
      email_confirm: true,
      user_metadata: { name: emp.name, role: emp.role },
    });
    if (error) {
      log.push(`❌ ${emp.name} (${emp.email}) — ${error.message}`);
    } else {
      log.push(`✅ ${emp.name} (${emp.email}) — 계정 생성`);
    }
  }

  // ── Step 2: 팀 ID 조회 ──
  const { data: teams } = await supabase.from('teams').select('id, name');
  const teamMap = new Map((teams || []).map(t => [t.name, t.id]));

  // ── Step 3: 전체 프로필 업데이트 ──
  const updates: ProfileUpdate[] = [
    // 경영진 (팀 미소속)
    { email: 'sbconsulting7890@gmail.com', phone: '010-2824-1794', position: '대표', employee_type: 'internal', team_name: null, sort_order: 1 },
    { email: 'leebjz2012@gmail.com', phone: '010-6669-1793', position: '이사', employee_type: 'internal', team_name: null, sort_order: 2 },
    { email: 'twlibraryst@gmail.com', phone: '010-9722-2357', position: '총괄팀장', employee_type: 'internal', team_name: null, sort_order: 3 },

    // 바이럴팀
    { email: 'cwkim5008@gmail.com', phone: '010-9703-3842', position: '팀장', employee_type: 'internal', team_name: '바이럴팀', sort_order: 1 },
    { email: 'a41732368@gmail.com', phone: '010-4173-2368', position: '팀원', employee_type: 'internal', team_name: '바이럴팀', sort_order: 2 },
    { email: 'lcukuj@gmail.com', phone: '010-9597-7218', position: '팀원', employee_type: 'internal', team_name: '바이럴팀', sort_order: 3 },

    // 상위노출팀
    { email: 'magimist001@gmail.com', phone: '010-8361-4938', position: '팀장', employee_type: 'internal', team_name: '상위노출팀', sort_order: 1 },

    // 브랜딩팀
    { email: 'wldhd222@gmail.com', phone: '010-6374-9318', position: '팀원', employee_type: 'internal', team_name: '브랜딩팀', sort_order: 1 },
    { email: 'vvip7404@gmail.com', phone: '010-9958-7404', position: '팀원', employee_type: 'internal', team_name: '브랜딩팀', sort_order: 2 },

    // 경영지원
    { email: 'djc486@naver.com', position: '팀원', employee_type: 'internal', team_name: '경영지원', sort_order: 1 },
  ];

  for (const u of updates) {
    const updateData: Record<string, unknown> = {};
    if (u.phone !== undefined) updateData.phone = u.phone;
    if (u.position !== undefined) updateData.position = u.position;
    if (u.employee_type !== undefined) updateData.employee_type = u.employee_type;
    if (u.sort_order !== undefined) updateData.sort_order = u.sort_order;
    if (u.mentor_role !== undefined) updateData.mentor_role = u.mentor_role;

    if ('team_name' in u) {
      updateData.team_id = u.team_name ? (teamMap.get(u.team_name) || null) : null;
    }

    const { error, count } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('email', u.email);

    if (error) {
      log.push(`❌ ${u.email} — ${error.message}`);
    } else {
      log.push(`✅ ${u.email} — 프로필 업데이트`);
    }
  }

  // ── Step 4: 신규 계정 role/name 보정 + 첫 로그인 비밀번호 변경 강제 ──
  for (const emp of newEmployees) {
    await supabase
      .from('profiles')
      .update({ role: emp.role, name: emp.name, must_change_password: true })
      .eq('email', emp.email);
  }
  log.push('✅ 신규 계정 role/name 보정 + 비밀번호 변경 필요 설정 완료');

  // ── Step 5: 블로그팀 사수/부사수 ──
  const blogTeamId = teamMap.get('블로그팀');
  if (blogTeamId) {
    const sasoo = [
      { email: 'xdxdxden@gmail.com', sort: 1 },     // 오현정
      { email: 'ironmindtiger@gmail.com', sort: 2 }, // 배재준
      { email: 'ashleyuu07@gmail.com', sort: 3 },    // 최은주
      { email: 'bora0091@gmail.com', sort: 4 },      // 김보라
      { email: 'bighouse2722@gmail.com', sort: 5 },  // 강태우
      { email: 'hedger123@naver.com', sort: 6 },     // 노민정
    ];
    for (const s of sasoo) {
      await supabase.from('profiles')
        .update({ team_id: blogTeamId, mentor_role: '사수', sort_order: s.sort })
        .eq('email', s.email);
    }
    log.push(`✅ 블로그팀 사수 ${sasoo.length}명 설정`);

    const busasoo = [
      { email: 'smile.haong@gmail.com', sort: 10 },       // 조하영
      { email: 'nona9797@naver.com', sort: 11 },           // 노나경
      { email: 'jueon920924@gmail.com', sort: 12 },        // 박주언
      { email: 'jaram0107@gmail.com', sort: 13 },          // 서경완
      { email: 'guswl01031589210@gmail.com', sort: 14 },   // 박현지
      { email: 'hyu9512@gmail.com', sort: 15 },            // 오현주
      { email: 'gmsma516@gmail.com', sort: 16 },           // 김차영
      { email: 'dhrkawk47@gmail.com', sort: 17 },          // 김다혜
    ];
    for (const b of busasoo) {
      await supabase.from('profiles')
        .update({ team_id: blogTeamId, mentor_role: '부사수', sort_order: b.sort })
        .eq('email', b.email);
    }
    log.push(`✅ 블로그팀 부사수 ${busasoo.length}명 설정`);
  }

  // ── Step 6: 신동민 role 변경 (admin → editor, 관리기능 유지 + 조직도 노출) ──
  const { error: sdmRoleErr } = await supabase
    .from('profiles')
    .update({ role: 'editor', employee_type: 'internal', position: '총괄팀장', sort_order: 3 })
    .eq('email', 'twlibraryst@gmail.com');
  if (sdmRoleErr) {
    log.push(`❌ 신동민 role 변경 실패 — ${sdmRoleErr.message}`);
  } else {
    log.push('✅ 신동민 role → editor (관리기능 유지 + 조직도 노출)');
  }

  // ── Step 7: acting_leader 설정 ──
  // 블로그팀, 브랜딩팀 → 신동민(총괄팀장)
  const { data: sdm } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'twlibraryst@gmail.com')
    .single();

  if (sdm) {
    await supabase
      .from('teams')
      .update({ acting_leader_id: sdm.id })
      .in('name', ['블로그팀', '브랜딩팀']);
    log.push('✅ 블로그팀/브랜딩팀 직무대행 → 신동민');
  }

  // 경영지원 → 이병준(이사) 총괄
  const { data: director } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'leebjz2012@gmail.com')
    .single();

  if (director) {
    await supabase
      .from('teams')
      .update({ acting_leader_id: director.id })
      .eq('name', '경영지원');
    log.push('✅ 경영지원 총괄 → 이병준(이사)');
  }

  // ── Step 8: 안형원 프로필 정리 (퇴사 예정) ──
  await supabase
    .from('profiles')
    .update({ team_id: null, employee_type: null, is_active: false })
    .eq('email', 'anhyeongwon4@gmail.com');
  log.push('✅ 안형원 — 비활성화 (퇴사 예정)');

  return NextResponse.json({ log });
}
