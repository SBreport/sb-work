import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { decryptJson, encryptJson, hasSecretKey } from '@/lib/survey-server';
import {
  consentGiven, missingRequired, sanitizeAnswers, secretsFilled, treatmentsOf, visibleItems,
  type Answers, type Kind,
} from '@/lib/survey';

// 로그인 없는 작성자용 API. 토큰 하나로 그 링크의 답만 읽고 쓴다.
// 표는 RLS로 잠겨 있어 service role(서버)만 접근한다.

type Ctx = { params: Promise<{ token: string }> };
const noStore = { 'Cache-Control': 'no-store' };
const fail = (error: string, status: number, extra: object = {}) => NextResponse.json({ error, ...extra }, { status, headers: noStore });

async function loadLink(token: string) {
  const db = createServerSupabase();
  const { data: link } = await db
    .from('survey_links')
    .select('id, branch_id, kind, nas_url, expires_at, status')
    .eq('token', token)
    .maybeSingle();
  if (!link) return { db, error: fail('not_found', 404) };
  if (new Date(link.expires_at).getTime() < Date.now()) return { db, error: fail('expired', 410) };
  return { db, link: link as { id: string; branch_id: string; kind: Kind; nas_url: string | null; expires_at: string; status: string } };
}

type Db = ReturnType<typeof createServerSupabase>;

/** 실장용 5-06의 기본값: 원장용 답에서 진료 이름(3-01)만 읽는다. 원장용의 다른 답은 읽지 않는다 */
async function ownerTreatments(db: Db, link: { branch_id: string }): Promise<string[]> {
  const { data: ownerLink } = await db.from('survey_links').select('id').eq('branch_id', link.branch_id).eq('kind', 'owner').maybeSingle();
  if (!ownerLink) return [];
  const { data } = await db.from('survey_answers').select('answers').eq('link_id', ownerLink.id).maybeSingle();
  return treatmentsOf({ '3-01': (data?.answers as Answers | undefined)?.['3-01'] });
}

async function filledFor(db: Db, linkId: string): Promise<{ filled: Record<string, boolean>; stored: Record<string, unknown> }> {
  const { data } = await db.from('survey_secrets').select('payload').eq('link_id', linkId).maybeSingle();
  if (!data || !hasSecretKey()) return { filled: secretsFilled({}), stored: {} };
  const stored = decryptJson(data.payload);
  return { filled: secretsFilled(stored), stored };
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const { db, link, error } = await loadLink(token);
  if (error) return error;

  // 서로 기다릴 필요가 없는 조회는 한꺼번에 보낸다(왕복 한 번 줄임)
  const [{ data: row }, { data: branch }, secrets] = await Promise.all([
    db.from('survey_answers').select('answers, saved_at, submitted_at').eq('link_id', link.id).maybeSingle(),
    db.from('branches').select('name').eq('id', link.branch_id).maybeSingle(),
    link.kind === 'owner' ? filledFor(db, link.id) : null,
  ]);
  const answers = (row?.answers ?? {}) as Answers;
  // 실장용을 열었는데 5-06이 비어 있으면 원장용 3-01 이름으로 미리 채운다(실장이 고칠 수 있다)
  if (link.kind === 'counsel' && link.status !== 'submitted' && !treatmentsOf(answers, 'counsel').length) {
    const names = await ownerTreatments(db, link);
    if (names.length) answers['5-06'] = names;
  }

  return NextResponse.json({
    kind: link.kind,
    status: link.status,
    branchName: branch?.name ?? '',
    nasUrl: link.nas_url,
    answers,
    savedAt: row?.saved_at ?? null,
    secretsFilled: secrets?.filled ?? {}, // 계정 값은 내려보내지 않는다 — 채웠는지만
  }, { headers: noStore });
}

const SECRET_IDS = ['1-01', '1-02', '1-03', '1-04'];
const short = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : '');

/** 이번에 보낸 계정 칸만 다듬어 돌려준다 */
function sanitizeSecrets(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const id of SECRET_IDS) {
    const v = r[id];
    if (id === '1-04') { if (typeof v === 'string') out[id] = short(v); }
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      out[id] = { id: short(o.id), pw: short(o.pw), ...(id === '1-02' ? { same: o.same === true } : {}) };
    }
  }
  return out;
}

/** PUT { answers, secrets?, submit? } — 임시 저장 또는 제출 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const { db, link, error } = await loadLink(token);
  if (error) return error;
  if (link.status === 'submitted') return fail('submitted', 409);

  const text = await request.text();
  if (text.length > 300_000) return fail('too_large', 413);
  let body: { answers?: unknown; secrets?: unknown; submit?: boolean };
  try { body = JSON.parse(text); } catch { return fail('bad_json', 400); }

  const answers = sanitizeAnswers(link.kind, body.answers);

  let filled: Record<string, boolean> = {};
  if (link.kind === 'owner') {
    const incoming = sanitizeSecrets(body.secrets);
    if (Object.keys(incoming).length && !hasSecretKey()) return fail('no_key', 500);
    const current = await filledFor(db, link.id);
    filled = current.filled;
    if (Object.keys(incoming).length) {
      const merged = { ...current.stored, ...incoming };
      const { error: e } = await db.from('survey_secrets')
        .upsert({ link_id: link.id, payload: encryptJson(merged), updated_at: new Date().toISOString() });
      if (e) return fail('save_failed', 500);
      filled = secretsFilled(merged);
    }
  }

  if (body.submit) {
    const treatments = treatmentsOf(answers, link.kind);
    const missing = missingRequired(visibleItems(link.kind, answers, { treatments }, filled));
    if (missing.length) return fail('missing', 400, { ids: [...new Set(missing.map(m => m.q.id))] });
  }

  const now = new Date().toISOString();
  const { data: prev } = await db.from('survey_answers').select('consent_at').eq('link_id', link.id).maybeSingle();
  const { error: saveError } = await db.from('survey_answers').upsert({
    link_id: link.id,
    answers,
    saved_at: now,
    consent_at: prev?.consent_at ?? (consentGiven(link.kind, answers) ? now : null),
    submitted_at: body.submit ? now : null,
  });
  if (saveError) return fail('save_failed', 500);
  const status = body.submit ? 'submitted' : 'draft';
  const { error: linkError } = await db.from('survey_links').update({ status }).eq('id', link.id);
  if (linkError) return fail('save_failed', 500);

  return NextResponse.json({ status, savedAt: now, secretsFilled: filled }, { headers: noStore });
}
