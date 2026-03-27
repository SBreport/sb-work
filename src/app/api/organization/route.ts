import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-guard';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/organization — 조직도 데이터 조회 (로그인 필요)
 * 팀 목록 + 팀원 정보를 한 번에 반환
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();

  // 팀 목록 조회
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, sort_order, acting_leader_id')
    .order('sort_order');

  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }

  // 조직도에 표시할 프로필 조회 (DB에서 필터링)
  const { data: members, error: membersError } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, position, mentor_role, sort_order, team_id, employee_type, is_active')
    .neq('is_active', false)
    .neq('name', 'admin')
    .or('team_id.not.is.null,employee_type.eq.internal,employee_type.eq.partner')
    .order('sort_order');

  const filteredMembers = members || [];

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  // acting_leader 이름 매핑
  const memberMap = new Map(filteredMembers.map(m => [m.id, m]));
  const teamsWithMembers = (teams || []).map(team => ({
    ...team,
    acting_leader_name: team.acting_leader_id ? memberMap.get(team.acting_leader_id)?.name ?? null : null,
    members: filteredMembers.filter(m => m.team_id === team.id),
  }));

  // 팀 미소속 경영진 (team_id가 null인 internal 멤버)
  const unassigned = filteredMembers.filter(m => !m.team_id);

  return NextResponse.json({ teams: teamsWithMembers, unassigned });
}

/**
 * POST /api/organization — 팀 생성 (admin only)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, sort_order = 0 } = body;

  if (!name) {
    return NextResponse.json({ error: '팀 이름이 필요합니다.' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('teams')
    .insert({ name, sort_order })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/organization — 팀 수정 또는 멤버 프로필 수정 (admin only)
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { type } = body; // 'team' or 'member'
  const supabase = createServerSupabase();

  if (type === 'team') {
    const { id, name, sort_order, acting_leader_id } = body;
    if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (acting_leader_id !== undefined) updates.acting_leader_id = acting_leader_id;

    const { error } = await supabase.from('teams').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  if (type === 'member') {
    const { id, team_id, position, mentor_role, sort_order, employee_type } = body;
    if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (team_id !== undefined) updates.team_id = team_id;
    if (position !== undefined) updates.position = position;
    if (mentor_role !== undefined) updates.mentor_role = mentor_role;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (employee_type !== undefined) updates.employee_type = employee_type;

    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: '유효하지 않은 type입니다.' }, { status: 400 });
}

/**
 * DELETE /api/organization — 팀 삭제 (admin only)
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('id');

  if (!teamId) {
    return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
  }

  const supabase = createServerSupabase();

  // 팀에 소속된 멤버의 team_id를 null로 변경
  await supabase.from('profiles').update({ team_id: null }).eq('team_id', teamId);

  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
