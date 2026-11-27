import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAdminOnly } from '@/lib/auth-guard';
import { createServerSupabase } from '@/lib/supabase-server';
import { decryptJson, expiryFromNow, hasSecretKey, newToken, parseNasUrl } from '@/lib/survey-server';
import { buildExport, type Answers, type Kind, type SurveySide } from '@/lib/survey';

// 병원 사전 설문 — 관리자 API. admin·editor만(requireAdmin). 삭제는 admin만(requireAdminOnly).

const noStore = { 'Cache-Control': 'no-store' };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

interface LinkRow {
  id: string; branch_id: string; kind: Kind; token: string; nas_url: string | null;
  expires_at: string; status: SurveySide['status']; created_at: string;
}
const LINK_COLS = 'id, branch_id, kind, token, nas_url, expires_at, status, created_at';

/**
 * GET /api/surveys                      — 지점 목록 + 설문 링크 목록
 * GET /api/surveys?branch=<id>          — 한 병원의 두 답 + 복사용 JSON
 * GET /api/surveys?branch=<id>&secrets=1 — 계정 정보(「보기」를 눌렀을 때만 부른다)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const db = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branch');

  if (!branchId) {
    const [branches, links] = await Promise.all([
      db.from('branches').select('id, name, status').order('name'),
      db.from('survey_links').select(LINK_COLS).order('created_at', { ascending: false }),
    ]);
    if (branches.error || links.error) return fail((branches.error || links.error)!.message, 500);
    const ids = (links.data ?? []).map(l => l.id);
    const { data: times } = ids.length
      ? await db.from('survey_answers').select('link_id, saved_at, submitted_at').in('link_id', ids)
      : { data: [] };
    return NextResponse.json({ branches: branches.data, links: links.data, times: times ?? [] }, { headers: noStore });
  }

  const { data: links, error } = await db.from('survey_links').select(LINK_COLS).eq('branch_id', branchId);
  if (error) return fail(error.message, 500);
  const rows = (links ?? []) as LinkRow[];
  const owner = rows.find(l => l.kind === 'owner');

  if (searchParams.get('secrets')) {
    if (!owner) return NextResponse.json({ secrets: {} }, { headers: noStore });
    const { data } = await db.from('survey_secrets').select('payload').eq('link_id', owner.id).maybeSingle();
    if (data && !hasSecretKey()) return fail('암호화 키(SURVEY_SECRET_KEY)가 서버에 없습니다.', 500);
    return NextResponse.json({ secrets: data ? decryptJson(data.payload) : {} }, { headers: noStore });
  }

  const [{ data: branch }, { data: answerRows }] = await Promise.all([
    db.from('branches').select('id, name').eq('id', branchId).maybeSingle(),
    rows.length
      ? db.from('survey_answers').select('link_id, answers, saved_at, submitted_at, consent_at').in('link_id', rows.map(l => l.id))
      : Promise.resolve({ data: [] as { link_id: string; answers: Answers; saved_at: string | null; submitted_at: string | null; consent_at: string | null }[] }),
  ]);
  if (!branch) return fail('지점을 찾을 수 없습니다.', 404);

  const side = (kind: Kind) => {
    const link = rows.find(l => l.kind === kind);
    if (!link) return null;
    const a = (answerRows ?? []).find(r => r.link_id === link.id);
    return {
      link,
      status: link.status,
      submittedAt: a?.submitted_at ?? null,
      savedAt: a?.saved_at ?? null,
      consentAt: a?.consent_at ?? null,
      answers: (a?.answers ?? {}) as Answers,
    };
  };
  const o = side('owner');
  const c = side('counsel');
  return NextResponse.json({ branch, owner: o, counsel: c, export: buildExport(branch, o, c) }, { headers: noStore });
}

/** POST { branchId, nasUrl } — 원장용·실장용 링크를 만든다(이미 있는 종류는 그대로 둔다) */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { branchId, nasUrl } = await request.json();
  const nas = parseNasUrl(nasUrl);
  if (typeof branchId !== 'string' || !branchId) return fail('지점을 골라주세요.', 400);
  if (nas === undefined) return fail('NAS 주소는 https:// 로 시작해야 합니다.', 400);

  const db = createServerSupabase();
  const { data: existing } = await db.from('survey_links').select('kind').eq('branch_id', branchId);
  const have = new Set((existing ?? []).map(l => l.kind));
  const rows = (['owner', 'counsel'] as Kind[]).filter(k => !have.has(k)).map(kind => ({
    branch_id: branchId,
    kind,
    token: newToken(),
    nas_url: kind === 'owner' ? nas : null, // 「자료 올리기」는 원장용 화면에만 있다
    expires_at: expiryFromNow(),
    created_by: auth.userId,
  }));
  if (!rows.length) return fail('이 지점의 링크가 이미 있습니다.', 409);
  const { error } = await db.from('survey_links').insert(rows);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ created: rows.length }, { headers: noStore });
}

/**
 * PATCH { linkId, action: 'reopen' }       — 다시 열기: 제출을 풀고 만료일을 오늘부터 30일로
 * PATCH { linkId, action: 'nas', nasUrl }  — NAS 주소 바꾸기
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { linkId, action, nasUrl } = await request.json();
  if (typeof linkId !== 'string' || !linkId) return fail('linkId가 필요합니다.', 400);
  const db = createServerSupabase();

  if (action === 'nas') {
    const nas = parseNasUrl(nasUrl);
    if (nas === undefined) return fail('NAS 주소는 https:// 로 시작해야 합니다.', 400);
    const { error } = await db.from('survey_links').update({ nas_url: nas }).eq('id', linkId);
    return error ? fail(error.message, 500) : NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === 'reopen') {
    const { data: link } = await db.from('survey_links').select('status').eq('id', linkId).maybeSingle();
    if (!link) return fail('링크를 찾을 수 없습니다.', 404);
    const { error } = await db.from('survey_links')
      .update({ status: link.status === 'submitted' ? 'draft' : link.status, expires_at: expiryFromNow() })
      .eq('id', linkId);
    if (error) return fail(error.message, 500);
    await db.from('survey_answers').update({ submitted_at: null }).eq('link_id', linkId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  return fail('알 수 없는 action', 400);
}

/** DELETE /api/surveys?branch=<id> — 그 병원의 링크·답·계정 정보를 모두 지운다(admin만, 되돌릴 수 없음) */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;
  const branchId = new URL(request.url).searchParams.get('branch');
  if (!branchId) return fail('branch가 필요합니다.', 400);
  const { error } = await createServerSupabase().from('survey_links').delete().eq('branch_id', branchId);
  return error ? fail(error.message, 500) : NextResponse.json({ ok: true }, { headers: noStore });
}
