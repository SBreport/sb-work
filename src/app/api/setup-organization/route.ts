import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-guard';
import { readFileSync } from 'fs';
import { join } from 'path';

// 시드 데이터 로드 (seed/organization-data.json)
function loadSeedData() {
  const filePath = join(process.cwd(), 'seed', 'organization-data.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

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
  team_name?: string | null;
  sort_order?: number;
}

// GET도 허용 (브라우저에서 쉽게 실행하기 위해)
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let seed;
  try {
    seed = loadSeedData();
  } catch {
    return NextResponse.json({ error: 'seed/organization-data.json 파일을 찾을 수 없습니다.' }, { status: 500 });
  }

  const supabase = createServerSupabase();
  const log: string[] = [];

  // ── Step 0: 테스트 계정 삭제 ──
  for (const email of seed.testAccounts) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profile) {
      await supabase.from('profiles').delete().eq('id', profile.id);
      await supabase.auth.admin.deleteUser(profile.id);
      log.push(`🗑️ ${email} 계정 삭제 완료`);
    }
  }

  // ── Step 1: 신규 계정 생성 ──
  const newEmployees: NewEmployee[] = seed.newEmployees;

  for (const emp of newEmployees) {
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
  const updates: ProfileUpdate[] = seed.profileUpdates;

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

    const { error } = await supabase
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
  if (blogTeamId && seed.blogTeamMentors) {
    for (const [role, members] of Object.entries(seed.blogTeamMentors)) {
      for (const m of members as { email: string; sort: number }[]) {
        await supabase.from('profiles')
          .update({ team_id: blogTeamId, mentor_role: role, sort_order: m.sort })
          .eq('email', m.email);
      }
      log.push(`✅ 블로그팀 ${role} ${(members as unknown[]).length}명 설정`);
    }
  }

  // ── Step 6: 신동민 role 변경 ──
  const { error: sdmRoleErr } = await supabase
    .from('profiles')
    .update({ role: 'editor', employee_type: 'internal', position: '총괄팀장', sort_order: 3 })
    .eq('email', seed.actingLeaders['신동민'].email);
  if (sdmRoleErr) {
    log.push(`❌ 신동민 role 변경 실패 — ${sdmRoleErr.message}`);
  } else {
    log.push('✅ 신동민 role → editor');
  }

  // ── Step 7: acting_leader 설정 ──
  for (const [name, config] of Object.entries(seed.actingLeaders)) {
    const { email, teams: teamNames } = config as { email: string; teams: string[] };
    const { data: leader } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (leader) {
      await supabase
        .from('teams')
        .update({ acting_leader_id: leader.id })
        .in('name', teamNames);
      log.push(`✅ ${teamNames.join('/')} 직무대행 → ${name}`);
    }
  }

  // ── Step 8: 비활성화 처리 ──
  for (const d of seed.deactivate) {
    await supabase
      .from('profiles')
      .update({ team_id: null, employee_type: null, is_active: false })
      .eq('email', d.email);
    log.push(`✅ ${d.email} — 비활성화 (${d.reason})`);
  }

  return NextResponse.json({ log });
}
