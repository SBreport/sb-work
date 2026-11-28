// 병원 사전 설문 점검: 문항 수, 조건·반복, JSON 복사 모양(sb-survey/1). 가상 병원 자료만 쓴다.
// 실행: node scripts/check-survey.mjs  (Node 23.6+ — .ts를 바로 읽는다)
import assert from 'node:assert/strict';
import {
  SURVEYS, visibleItems, missingRequired, pageStates, buildExport, sanitizeAnswers, secretsFilled, treatmentsOf, consentGiven,
} from '../src/lib/survey.ts';

const ids = kind => SURVEYS[kind].pages.flatMap(p => p.questions.map(q => q.id));
assert.equal(SURVEYS.owner.pages.length, 10);
assert.equal(ids('owner').length, 72); // 문항 71 + 자료 올리기
assert.equal(ids('counsel').length, 12);
assert.equal(new Set([...ids('owner'), ...ids('counsel')]).size, 84, '문항 ID 중복');
for (const gone of ['2-13', '6-03', '6-06', '7-00', '8-02', '8-03', '8-04', '9-03', '9-05', '9-10', '9-11', '9-12']) assert.ok(!ids('owner').includes(gone), `${gone}은 뺀 문항`);

const owner = {
  '4-01': true,
  '1-05': '필요', '1-06': '블로그',
  '2-01': '기존 운영', '2-02': '2020-01-01', // 조건이 안 맞아 빠져야 한다
  '2-03': '가상원장', '2-04': '010-0000-0000', '2-05': '가상과 전문의', '2-06': '가상실장', '2-07': '010-0000-0001',
  '2-09': [{ major: '가상과', count: '1', name: '김가상' }, { major: '', count: '', name: '' }],
  '2-10': '없음', '2-10-2': '있음', // 조건이 안 맞아 빠져야 한다
  '2-11': ['대표원장', '김가상', '없는원장'],
  '3-01': ['진료 A', '진료 B', '진료 C', '', ' '],
  '3-02': { r1: ['진료 A'], r2: ['진료 B', '진료 C'], r3: ['지워진 진료'], unknown: false },
  '3-02-1': true,
  '3-05': { 대표원장: { r1: ['진료 B'], r2: [], r3: [] }, 김가상: { r1: ['진료 A'] } },
  '3-06': ['진료 A'],
  '3-06-1': { '진료 A': '가상 수련' },
  '3-07': { '진료 A': ['전문의 자격', '학회 정회원·임원', '인증받은 장비'], '진료 B': ['수상'] },
  '3-07-2': { '진료 A': '가상 장비' },
  '3-07-1': { '진료 A': '안 보여야 함' },
  '3-11': { '진료 A': '멀어도 찾아오는 분이 많다', '진료 B': '모르겠다', '진료 C': '가까워서 오는 분이 많다' },
  '3-12': [{ name: '가상병원', reason: 'r', better: 'b', worse: 'w', extra: 'x' }, {}],
  '7-02': { '진료 A': '가상 검사', '진료 B': '자신 있는 진료가 아니라 빠져야 함' },
  '1-01': { id: 'x', pw: 'y' }, // 계정은 답 JSON에 들어오면 안 된다
};
const clean = sanitizeAnswers('owner', { ...owner, 'hack': 1 });
assert.ok(!('1-01' in clean) && !('hack' in clean));

const ctx = { treatments: treatmentsOf(clean) };
assert.deepEqual(ctx.treatments, ['진료 A', '진료 B', '진료 C']);
const filled = secretsFilled({ '1-01': { id: 'a', pw: 'b' }, '1-02': { same: true } });
assert.deepEqual(filled, { '1-01': true, '1-02': true, '1-03': false, '1-04': false });

const items = visibleItems('owner', clean, ctx, filled);
assert.deepEqual(missingRequired(items).map(i => i.q.id), [], '필수가 다 찼는데 빠진 것이 있다');
assert.ok(missingRequired(visibleItems('owner', clean, ctx, {})).some(i => i.q.id === '1-01'), '계정 필수 판정');
assert.ok(items.some(i => i.q.id === '3-05-2'), '매출 1위(A)와 키우고 싶은 1위(B)가 달라 3-05-2가 보여야 한다');
assert.equal(pageStates('owner', items)[0], 'done');
assert.equal(pageStates('owner', items)[7], 'empty');
assert.ok(consentGiven('owner', clean) && !consentGiven('counsel', {}));

// 실장용은 자기 5-06 진료 이름으로 답한다 — 원장용이 비어 있어도 혼자 제출할 수 있다
const counsel = {
  '5-00': { name: '가상실장', title: '상담실장', consent: true },
  '5-06': ['진료 A', '진료 B', '', '', ''],
  '3-03': { r1: ['진료 B'], r2: [], r3: [], unknown: false, feel: true },
  '3-04': { unknown: true },
  '3-09': '가까워서',
  '5-02': { '진료 A': '가상병원', '없는 진료': 'x' },
};
const cctx = { treatments: treatmentsOf(counsel, 'counsel') };
assert.deepEqual(cctx.treatments, ['진료 A', '진료 B']);
assert.deepEqual(missingRequired(visibleItems('counsel', counsel, cctx)), [], '실장 단독 제출: 필수가 다 찼다');
assert.ok(missingRequired(visibleItems('counsel', { ...counsel, '5-00': { name: 'a' } }, cctx)).length === 1, '동의 없는 5-00은 미완');
assert.deepEqual(missingRequired(visibleItems('counsel', { ...counsel, '5-06': [] }, { treatments: [] })).map(i => i.q.id), ['5-06'], '5-06이 비면 5-06만 막는다(순위는 모름으로 답함)');
const solo = buildExport({ id: 'b1', name: 'x' }, null, { status: 'submitted', submittedAt: null, answers: counsel });
assert.deepEqual(solo.counsel.answers['5-06'], ['진료 A', '진료 B']);
assert.deepEqual(solo.counsel.answers['3-03'].r1, ['진료 B'], '원장용이 없어도 실장용 순위가 남는다');
assert.deepEqual(solo.owner.answers, {});

const out = buildExport(
  { id: 'b1', name: '가상의원 가상점' },
  { status: 'submitted', submittedAt: '2026-11-27T00:00:00.000Z', answers: clean },
  { status: 'draft', submittedAt: null, answers: counsel },
);
assert.equal(out.schema, 'sb-survey/1');
assert.deepEqual(Object.keys(out), ['schema', 'branch', 'owner', 'counsel']);
assert.equal(out.owner.submittedAt, '2026-11-27T09:00:00+09:00');
assert.equal(out.counsel.status, 'draft');
const oa = out.owner.answers;
assert.deepEqual(oa['3-01'], ['진료 A', '진료 B', '진료 C']);
assert.deepEqual(oa['3-02'], { r1: ['진료 A'], r2: ['진료 B', '진료 C'], r3: [], unknown: false });
assert.equal(oa['3-02-1'], true);
assert.deepEqual(oa['3-06'], ['진료 A']);
assert.deepEqual(oa['3-07'], { '진료 A': ['전문의 자격', '학회 정회원·임원', '인증받은 장비'] });
assert.deepEqual(oa['3-11'], owner['3-11']);
assert.deepEqual(oa['3-12'], [{ name: '가상병원', reason: 'r', better: 'b', worse: 'w' }]);
assert.deepEqual(oa['7-02'], { '진료 A': '가상 검사' });
assert.deepEqual(oa['2-11'], ['대표원장', '김가상']);
assert.deepEqual(Object.keys(oa['3-05']), ['대표원장', '김가상']);
for (const gone of ['2-02', '2-10-2', '3-07-1', '1-01', '1-02', '1-03', '1-04', '2-08']) assert.ok(!(gone in oa), `${gone}은 빠져야 한다`);
assert.equal(oa['1-05'], '필요');
assert.deepEqual(out.counsel.answers['5-00'], { name: '가상실장', title: '상담실장', consent: true });
assert.deepEqual(out.counsel.answers['3-03'], { r1: ['진료 B'], r2: [], r3: [], unknown: false, feel: true });
assert.deepEqual(out.counsel.answers['5-06'], ['진료 A', '진료 B']);
assert.deepEqual(out.counsel.answers['5-02'], { '진료 A': '가상병원' });

// 옛 답이 섞인 응답: 뺀 문항의 답과 3-06에 없는 진료의 7-xx 답은 오류 없이 무시된다(DB의 답은 고치지 않는다)
const legacy = { ...owner, '2-13': ['진료별 매출'], '7-00': '옛 공통 질문', '9-12': ['진료 A'], '6-03': { 대표원장: '옛 답' }, '7-04': { '진료 C': '옛 답' } };
const legacyItems = visibleItems('owner', legacy, ctx, filled);
assert.ok(!legacyItems.some(i => ['2-13', '7-00', '9-12', '6-03'].includes(i.q.id)), '뺀 문항은 화면 목록에 없다');
assert.deepEqual(legacyItems.filter(i => i.q.id.startsWith('7-')).map(i => i.inst).filter((v, i, l) => l.indexOf(v) === i), ['진료 A'], '진료별 상세는 자신 있는 진료만');
assert.equal(legacyItems.find(i => i.q.id === '7-03').req, 'recommended');
const lo = buildExport({ id: 'b1', name: 'x' }, { status: 'draft', submittedAt: null, answers: legacy }, null).owner.answers;
for (const gone of ['2-13', '7-00', '9-12', '6-03', '7-04']) assert.ok(!(gone in lo), `${gone}은 JSON에 없다`);
assert.deepEqual(lo['7-02'], { '진료 A': '가상 검사' });
assert.ok(!('2-13' in sanitizeAnswers('owner', legacy)), '다음 저장 때 뺀 문항 키는 받지 않는다');

const none = buildExport({ id: 'b1', name: 'x' }, null, null);
assert.equal(none.counsel.status, 'none');
console.log('survey check OK');
