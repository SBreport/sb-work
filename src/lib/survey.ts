// 병원 사전 설문 — 문항 정의와 공용 계산 (SecondBrain 이슈 #68)
// 문항 원본: 「병원 사전 설문 — 문항 확정본」 v2.1. 문항 ID는 복사되는 JSON의 키라서 바꾸지 않는다.
// 이 파일은 import가 없다 — 화면·서버·점검 스크립트(scripts/check-survey.mjs)가 같은 파일을 읽는다.

export type Kind = 'owner' | 'counsel';
export type Answers = Record<string, unknown>;
export type Req = 'required' | 'recommended';

/** 계산에 필요한 바깥 정보. treatments = 원장용 3-01 진료 목록(실장용은 서버가 원장용 답에서 읽어 준다) */
export interface Ctx {
  treatments: string[];
  nasUrl?: string | null;
}

export interface Field {
  key: string;
  label: string;
  type?: 'text' | 'long' | 'tel' | 'number' | 'password' | 'check' | 'single';
  options?: string[];
}

export interface Question {
  id: string;
  label: string;
  hint?: string;
  type:
    | 'text' | 'long' | 'tel' | 'email' | 'date'
    | 'single' | 'multi' | 'check'
    | 'list'    // 짧은 글 여러 칸 → 문자열 배열
    | 'pick'    // 진료 고르기 → 진료명 배열
    | 'rank'    // 진료 순위 → { r1, r2, r3, unknown }
    | 'table'   // 줄을 더하는 표 → 객체 배열
    | 'fields'  // 이름 붙은 칸 묶음 → 객체
    | 'upload'; // 「자료 올리기」 버튼(답 없음)
  req?: Req | ((a: Answers, inst: string | null) => Req | undefined);
  options?: string[] | ((a: Answers) => string[]);
  extras?: string[];  // pick: 진료 대신 고르는 보기(없음·모름)
  max?: number;       // pick: 고를 수 있는 수 / list: 칸 수 / table: 줄 수
  feel?: boolean;     // rank: 「체감으로 적음」 체크
  fields?: Field[];   // fields의 칸 / table의 열
  /** 반복 묶음. treatment=진료마다, treatment-cf=진료마다(자신 있는 진료 먼저), confident=자신 있는 진료마다,
   *  doctor=원장마다, doctor-opt=의사 여럿이고 2-11을 골랐을 때만 원장마다 */
  repeat?: 'treatment' | 'treatment-cf' | 'confident' | 'doctor' | 'doctor-opt';
  when?: (a: Answers, ctx: Ctx, inst: string | null) => boolean;
  complete?: (v: unknown) => boolean; // 필수 판정에 「일부만 씀」을 가려야 할 때
  secret?: boolean;   // 계정 정보 — 답 JSON이 아니라 암호화 표에 저장, JSON 복사 제외
}

export interface Page {
  title: string;
  note?: string;
  questions: Question[];
}

export interface SurveyDef {
  title: string;
  intro: string[];
  consent: string[];
  consentId: string;
  pages: Page[];
}

/* ── 값 읽기 도우미 ── */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const uniq = (list: string[]) => [...new Set(list)];

function tableRows(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is Record<string, unknown> => isObj(r) && Object.values(r).some(x => str(x)));
}

/** 3-01에 적은 진료 이름(빈칸·중복 제거) */
export function treatmentsOf(a: Answers): string[] {
  return uniq(strs(a['3-01']));
}

/** 「의사 여럿」 = 2-09에 한 줄이라도 적혔을 때 */
const multiDoctor = (a: Answers) => tableRows(a['2-09']).length > 0;

/** 원장 보기: 대표원장 + 2-09의 성함(성함이 비면 「전공 번호」) */
export function doctorsOf(a: Answers): string[] {
  return uniq(['대표원장', ...tableRows(a['2-09']).map((r, i) => str(r.name) || `${str(r.major) || '의사'} ${i + 1}`)]);
}

function chosenDoctors(a: Answers): string[] {
  if (!multiDoctor(a)) return [];
  const all = doctorsOf(a);
  return strs(a['2-11']).filter(d => all.includes(d));
}

const confidentOf = (a: Answers, ctx: Ctx) => strs(a['3-06']).filter(t => ctx.treatments.includes(t));

const rank1 = (v: unknown): string => (isObj(v) ? strs(v.r1)[0] ?? '' : '');

/** 가장 키우고 싶은 진료(3-05 1순위). 원장마다 답했으면 2-12에서 앞세운 원장, 없으면 첫 원장의 답 */
function grow1(a: Answers): string {
  const v = a['3-05'];
  if (!isObj(v)) return '';
  const docs = chosenDoctors(a);
  if (!docs.length) return rank1(v);
  const lead = str(a['2-12']);
  return rank1(v[docs.includes(lead) ? lead : docs[0]]);
}

function firstOf(a: Answers, col: string): string {
  return str(tableRows(a['3-15']).find(r => str(r[col]) === '1')?.type);
}

/* ── 문항 ── */

const EVIDENCE = [
  '전문의 자격', '학력·직함(외래교수 등)', '학회 정회원·임원', '학회·학술지 게재(논문·발표)',
  '국가공인·전문기관 인증', '인증받은 장비', '수상', '언론 보도', '제조사·민간 교육 수료', '없음', '모름',
];
const GOALS: Field[] = [
  { key: 'm3', label: '3개월' }, { key: 'm6', label: '6개월' }, { key: 'y1', label: '1년' }, { key: 'y3', label: '3년' },
];
const ACCOUNT: Field[] = [{ key: 'id', label: '아이디' }, { key: 'pw', label: '비밀번호', type: 'password' }];
const includes = (v: unknown, x: string) => strs(v).includes(x);
const perInst = (a: Answers, id: string, inst: string | null) => (isObj(a[id]) && inst ? (a[id] as Record<string, unknown>)[inst] : undefined);
const longs = (list: [string, string][]): Question[] => list.map(([id, label]) => ({ id, label, type: 'long' }));

const OWNER: SurveyDef = {
  title: '병원 사전 설문 (원장님용)',
  intro: [
    '안녕하세요. 병원에 맞는 마케팅 방향을 정하기 위한 설문입니다.',
    '한 번에 다 쓰지 않으셔도 됩니다. 페이지마다 저장되고, 같은 링크로 이어서 쓸 수 있습니다.',
    '「진료와 순위」, 「자신 있는 진료」는 원장님이 직접 답해주세요.',
    '정확한 숫자를 몰라도 괜찮습니다. 순위만 골라주셔도 됩니다. 모르시면 「모름」을 골라주세요.',
    '환자의 이름·연락처·얼굴·진료기록은 적지 말아주세요.',
    '계정 아이디와 비밀번호는 「계정·인계」 페이지에만 적어주세요. 담당 팀만 열람하고 마케팅 업무에만 씁니다. 복구코드·인증번호는 어디에도 적지 말아주세요.',
  ],
  // 동의 문구 — 2026-11-27 사용자 확정. 보관 기간은 법 검토를 거친 값이 아니다(이슈 #68)
  consent: [
    '수집 항목: 원장님·상담 담당자 성함과 휴대폰, 이메일, 병원 계정 정보(네이버 블로그·플레이스·인스타그램 아이디와 비밀번호, 인증 문자를 받는 분 휴대폰)',
    '쓰는 목적: 병원 마케팅 방향을 정하고 마케팅 대행 업무를 하는 데에만 씁니다.',
    '보관 기간: 마케팅 대행 계약이 끝날 때까지 보관하고, 계약이 끝난 뒤 1년 안에 삭제합니다.',
    '동의하지 않으실 수 있습니다. 다만 동의하지 않으시면 설문을 진행할 수 없습니다.',
  ],
  consentId: '4-01',
  pages: [
    {
      title: '시작',
      questions: [
        { id: '4-01', label: '적어주신 계정·연락처 정보를 마케팅 업무에만 사용하는 데 동의합니다.', type: 'check', req: 'required' },
      ],
    },
    {
      title: '계정·인계',
      note: '아이디와 비밀번호는 암호화해 따로 보관하고, 저장한 뒤에는 이 화면에서도 가려집니다. 복구코드·인증번호는 적지 말아주세요.',
      questions: [
        { id: '1-01', label: '네이버 블로그 아이디 / 비밀번호', type: 'fields', fields: ACCOUNT, req: 'required', secret: true },
        {
          id: '1-02', label: '네이버 플레이스 아이디 / 비밀번호', type: 'fields', req: 'required', secret: true,
          fields: [...ACCOUNT, { key: 'same', label: '블로그와 같음', type: 'check' }],
        },
        { id: '1-03', label: '인스타그램 아이디 / 비밀번호', hint: '인스타그램 마케팅을 함께 하실 때만 적어주세요.', type: 'fields', fields: ACCOUNT, secret: true },
        { id: '1-04', label: '새 기기에서 로그인할 때 인증 문자를 받는 분 휴대폰', type: 'tel', req: 'recommended', secret: true },
        { id: '1-05', label: '이전 광고대행사에서 계정이나 자료를 넘겨받아야 하나요?', type: 'single', options: ['필요', '불필요', '모름'], req: 'required' },
        { id: '1-06', label: '넘겨받아야 하는 분야', type: 'long', when: a => a['1-05'] === '필요' },
      ],
    },
    {
      title: '병원 정보',
      questions: [
        { id: '2-01', label: '병원 현재 상태', type: 'single', options: ['기존 운영', '오픈(개원) 준비', '이전', '확장'], req: 'required' },
        { id: '2-02', label: '개원일', type: 'date', when: a => !!str(a['2-01']) && a['2-01'] !== '기존 운영' },
        { id: '2-03', label: '원장님 성함', type: 'text', req: 'required' },
        { id: '2-04', label: '원장님 휴대폰', type: 'tel', req: 'required' },
        { id: '2-05', label: '대표 원장님 전공과 자격 취득일', hint: '전문의라면 정확한 과목명, 아니면 일반의', type: 'text', req: 'required' },
        { id: '2-06', label: '상담을 가장 많이 맡는 분 성함 (직책과 관계없이)', type: 'text', req: 'required' },
        { id: '2-07', label: '그분 휴대폰', type: 'tel', req: 'required' },
        { id: '2-08', label: '자료를 받으실 이메일', type: 'email' },
        {
          id: '2-09', label: '의사 구성 (대표 원장님 제외)', type: 'table', max: 20,
          fields: [{ key: 'major', label: '전공' }, { key: 'count', label: '인원', type: 'number' }, { key: 'name', label: '성함(선택)' }],
        },
        { id: '2-10', label: '같은 브랜드의 다른 지점이 있나요?', type: 'single', options: ['있음', '없음'], req: 'required' },
        {
          id: '2-10-1', label: '가장 가까운 지점의 위치', type: 'fields', when: a => a['2-10'] === '있음',
          fields: [{ key: 'value', label: '위치' }, { key: 'unknown', label: '모름', type: 'check' }],
        },
        { id: '2-10-2', label: '본사 공통 마케팅 가이드가 있나요?', type: 'single', options: ['있음', '없음', '모름'], when: a => a['2-10'] === '있음' },
        {
          id: '2-11', label: '원장님 이름으로 나가는 콘텐츠(영상, 원장님 블로그 등)는 어느 원장님들이 하시나요?',
          type: 'multi', options: doctorsOf, req: 'recommended', when: multiDoctor,
        },
        {
          id: '2-12', label: '병원 이름으로 나가는 홍보에서는 어느 원장님을 가장 앞세울까요?',
          type: 'single', options: doctorsOf, req: 'recommended', when: multiDoctor,
        },
        {
          id: '2-13', label: '병원 프로그램(차트·예약)에서 뽑을 수 있는 자료', type: 'multi',
          options: ['진료별 매출', '진료별 신규 환자 수', '환자 거주 지역', '내원 경로', '없음', '모름'],
        },
      ],
    },
    {
      title: '진료와 순위',
      note: '원장님이 직접 답해주세요.',
      questions: [
        { id: '3-01', label: '현재 주요 진료를 5개 이내로 적어주세요. 아래 질문은 이 이름으로 답합니다.', type: 'list', max: 5, req: 'required' },
        { id: '3-01-1', label: '진료마다 맡는 원장님', type: 'multi', options: doctorsOf, repeat: 'treatment', req: 'recommended', when: multiDoctor },
        { id: '3-02', label: '매출이 큰 진료 1~3순위', type: 'rank', req: 'required' },
        { id: '3-02-1', label: '위 순위는 결제 집계를 보고 적었습니다.', type: 'check' },
        { id: '3-05', label: '앞으로 키우고 싶은 진료 1~3순위', type: 'rank', repeat: 'doctor-opt', req: 'required' },
        { id: '3-05-1', label: '메인으로 밀고 싶지 않은 진료', type: 'pick', extras: ['없음'], req: 'recommended' },
        {
          id: '3-05-2', label: '매출이 가장 큰 진료와 가장 키우고 싶은 진료가 다릅니다. 어느 쪽을 먼저 키우고 싶으세요?',
          type: 'single', req: 'recommended',
          options: a => [rank1(a['3-02']), grow1(a)].filter(Boolean),
          when: a => !!rank1(a['3-02']) && !!grow1(a) && rank1(a['3-02']) !== grow1(a),
        },
        {
          id: '3-15', label: '요즘 오시는 분들을 오시는 이유로 나누면 어떤 분들이 있나요? 2~4가지로 적고, 매출이 큰 순서와 더 받고 싶은 순서를 매겨주세요.',
          type: 'table', max: 4, req: 'recommended',
          fields: [
            { key: 'type', label: '환자 유형' },
            { key: 'revenueRank', label: '매출 순서', type: 'single', options: ['1', '2', '3', '4'] },
            { key: 'wantRank', label: '받고 싶은 순서', type: 'single', options: ['1', '2', '3', '4'] },
          ],
        },
        {
          id: '3-15-1', label: '두 순서의 1위가 다릅니다. 어느 분을 먼저 모시고 싶으세요?', type: 'single',
          options: a => [firstOf(a, 'revenueRank'), firstOf(a, 'wantRank')].filter(Boolean),
          when: a => !!firstOf(a, 'revenueRank') && !!firstOf(a, 'wantRank') && firstOf(a, 'revenueRank') !== firstOf(a, 'wantRank'),
        },
        { id: '3-10', label: '앞으로 가장 많이 오셨으면 하는 환자 한 분을 상황으로 설명해주세요.', hint: '어떤 고민으로 오시는 분인지', type: 'long' },
      ],
    },
    {
      title: '자신 있는 진료',
      note: '원장님이 직접 답해주세요.',
      questions: [
        { id: '3-06', label: '가장 자신 있는 진료 1~2개', type: 'pick', max: 2, req: 'required' },
        { id: '3-06-1', label: '그 진료를 잘하게 된 과정', hint: '수련·근무·연구 등 언제부터 어떤 경험을 쌓아 오셨는지', type: 'long', repeat: 'confident', req: 'required' },
        {
          id: '3-06-2', label: '그 진료 또는 그 분야 경력', type: 'fields', repeat: 'confident', req: 'recommended',
          fields: [{ key: 'years', label: '경력(년)', type: 'number' }, { key: 'what', label: '무엇의 경력인지' }],
        },
        { id: '3-07', label: '그 진료에 해당하는 근거를 모두 골라주세요.', type: 'multi', options: EVIDENCE, repeat: 'confident', req: 'recommended' },
        { id: '3-07-2', label: '인증받은 장비 이름', type: 'text', repeat: 'confident', when: (a, _c, inst) => includes(perInst(a, '3-07', inst), '인증받은 장비') },
        {
          id: '3-07-1', label: '어떤 진료 방법에 대한 발표·논문인지 (한 줄에 하나)', type: 'long', repeat: 'confident',
          when: (a, _c, inst) => includes(perInst(a, '3-07', inst), '학회·학술지 게재(논문·발표)'),
        },
        { id: '3-08-a', label: '다른 병원과 실제로 다른 점', type: 'long', repeat: 'confident', req: 'recommended' },
        { id: '3-08-b', label: '원장님이 직접 만들거나 고친 방법이 있다면', type: 'long', repeat: 'confident' },
        { id: '3-08-c', label: '지금 이 진료 환자를 더 받으실 수 있나요?', type: 'single', options: ['여유 있음', '빠듯함', '더 받기 어려움'], repeat: 'confident', req: 'recommended' },
        {
          id: '자료', type: 'upload', when: (_a, ctx) => !!ctx.nasUrl,
          label: '자격증·학회 회원증·인증서·논문 사본, 원장님 프로필 사진, 진료 공간·장비 사진, 진료 과정 사진·영상, 언론 보도 자료를 올려주세요.',
        },
        { id: '3-08-1', label: '진료와 상관없이 상담·사후관리에서 꼭 지키는 것', type: 'long' },
        { id: '3-14', label: '원내에서 생각하는 가장 큰 강점', type: 'long' },
      ],
    },
    {
      title: '환자와 경쟁',
      questions: [
        {
          id: '3-11', label: '진료별로 환자가 주로 어디서 오시나요?', type: 'single', repeat: 'treatment', req: 'required',
          options: ['가까워서 오는 분이 많다', '멀어도 찾아오는 분이 많다', '모르겠다'],
        },
        {
          id: '3-12', label: '환자들이 우리 병원과 비교한다고 알고 계신 병원 (최대 3곳, 같은 브랜드 지점 포함)', type: 'table', max: 3, req: 'recommended',
          fields: [
            { key: 'name', label: '병원명' }, { key: 'reason', label: '환자가 그 병원을 고르는 이유' },
            { key: 'better', label: '우리가 더 나은 점' }, { key: 'worse', label: '우리가 부족한 점' },
          ],
        },
      ],
    },
    {
      title: '진료별 상세',
      note: '콘텐츠를 만들 때 쓰는 재료입니다. 아는 만큼만 적어주세요.',
      questions: [
        { id: '7-00', label: '여러 진료에 공통으로 환자분들이 자주 묻는 질문과 그 답', type: 'long' },
        ...([
          ['7-01', '주로 어떤 증상이나 고민으로 오시나요?', 'long'],
          ['7-02', '검사·진단은 어떻게 하시나요?', 'long'],
          ['7-03', '치료·시술은 어떤 순서로 진행되나요? 우리 병원만의 방식이 있다면 함께 적어주세요.', 'long'],
          ['7-04', '회복 기간과 주의할 점', 'long'],
          ['7-05', '이 진료만의 자주 묻는 질문과 그 답', 'long'],
          ['7-06', '통증이나 부작용을 걱정하는 분께 드리고 싶은 말', 'long'],
          ['7-07', '1회 비용(대략)과 보통 받으시는 횟수', 'text'],
          ['7-08', '지금까지 해 오신 건수(대략)', 'text'],
        ] as [string, string, 'long' | 'text'][]).map(([id, label, type]): Question => ({
          id, label, type, repeat: 'treatment-cf',
          // 자신 있는 진료의 검사·진단, 치료 순서만 권장
          req: id === '7-02' || id === '7-03' ? (a, inst) => (inst && includes(a['3-06'], inst) ? 'recommended' : undefined) : undefined,
        })),
      ],
    },
    {
      title: '원장님 이야기',
      note: '콘텐츠를 만들 때 쓰는 재료입니다.',
      questions: ([
        ['6-01', '지금 진료과목을 고르신 이유', 'long'],
        ['6-02', '진료할 때 가장 중요하게 여기시는 생각(진료 철학)', 'long'],
        ['6-03', '수련·근무하시며 기억에 남는 경험과 그때 느끼신 점', 'long'],
        ['6-04', '개원하신 계기와 이 지역을 고르신 이유', 'long'],
        ['6-05', '원장님 성격을 잘 드러내는 말 두세 개 (예: 꼼꼼함, 친근함, 솔직함)', 'text'],
        ['6-06', '참여하시는 학회·세미나·강의 일정', 'long'],
      ] as [string, string, 'long' | 'text'][]).map(([id, label, type]): Question => ({ id, label, type, repeat: 'doctor' })),
    },
    {
      title: '장비·시설·운영',
      note: '콘텐츠를 만들 때 쓰는 재료입니다.',
      questions: [
        ...longs([
          ['8-01', '대표 장비의 이름과 그 장비를 고르신 이유'],
          ['8-02', '원내 시설(검사실·수술실·회복실 등)을 갖추신 이유'],
          ['8-03', '병원 공간을 꾸미며 특별히 신경 쓰신 점'],
          ['8-04', '직원 교육이나 안전 점검은 어떻게 하시나요?'],
          ['8-05', '처음 상담부터 치료, 사후 관리까지 환자가 거치는 과정'],
        ]),
        {
          id: '8-06', label: '주변 병원과 비교하면 비용은 어느 편인가요? 그 이유는요?', type: 'fields',
          fields: [
            { key: 'level', label: '비용', type: 'single', options: ['높은 편', '비슷함', '낮은 편', '모름'] },
            { key: 'reason', label: '이유', type: 'long' },
          ],
        },
        { id: '8-07', label: '이윤이 가장 많이 남는 진료 1~3순위', type: 'rank' },
      ],
    },
    {
      title: '환자 이야기·목표·콘텐츠 방향',
      note: '콘텐츠를 만들 때 쓰는 재료입니다.',
      questions: [
        ...longs([
          ['9-01', '기억에 남는 환자분 (이름·연락처 없이)'],
          ['9-02', '받으신 감사 인사나 선물 중 마음에 남은 것'],
          ['9-03', '멀리서 일부러 찾아오시는 환자분이 있나요? 어디에서 오시나요?'],
          ['9-04', '지금 병원의 가장 큰 고민이나 아쉬운 점'],
        ]),
        { id: '9-05', label: '지금까지 진료하신 환자 수(대략)', type: 'text' },
        { id: '9-06', label: '한 달 평균 환자 수와 신환 수', type: 'text' },
        { id: '9-07', label: '마케팅 뒤 신환 목표', type: 'fields', fields: GOALS },
        { id: '9-08', label: '마케팅 뒤 매출 목표', type: 'fields', fields: GOALS },
        ...longs([
          ['9-09', '의료진으로서 최종 목표'],
          ['9-10', '앞으로 의료진을 더 모실 계획'],
          ['9-11', '환자분들께 가장 알리고 싶은 병원의 모습'],
        ]),
        { id: '9-12', label: '콘텐츠에서 특히 강조하고 싶은 진료', type: 'pick' },
        ...longs([
          ['9-13', '찾아오는 환자분께 드릴 수 있는 약속 한 가지'],
          ['9-14', '촬영과 원고 확인은 누가, 얼마나 자주 해 주실 수 있나요?'],
          ['9-15', '콘텐츠를 만들 때 주의해야 할 점 (의료광고 심의·보건소 수정 요청 경험 포함)'],
          ['9-16', '저희에게 부탁하실 점, 그 밖에 꼭 알아야 할 것'],
        ]),
      ],
    },
  ],
};

const COUNSEL: SurveyDef = {
  title: '병원 사전 설문 (상담 담당자용)',
  intro: [
    '안녕하세요. 병원 마케팅 방향을 정하기 위한 설문 중 상담을 맡으시는 분께 여쭙는 부분입니다. 10분 정도 걸립니다.',
    '환자분들이 실제로 하신 말을 기억나는 대로 적어주세요.',
    '환자의 이름·연락처·얼굴·진료기록은 적지 말아주세요.',
    '모르시면 「모름」을 골라주세요.',
  ],
  // 동의 문구 — 2026-11-27 사용자 확정. 법 검토 전
  consent: [
    '수집 항목: 작성하시는 분의 성함과 직책',
    '쓰는 목적: 병원 마케팅 방향을 정하고 마케팅 대행 업무를 하는 데에만 씁니다.',
    '보관 기간: 마케팅 대행 계약이 끝날 때까지 보관하고, 계약이 끝난 뒤 1년 안에 삭제합니다.',
    '동의하지 않으실 수 있습니다. 다만 동의하지 않으시면 설문을 진행할 수 없습니다.',
  ],
  consentId: '5-00',
  pages: [
    {
      title: '시작',
      questions: [
        {
          id: '5-00', label: '작성하시는 분 성함과 직책, 정보 이용 동의', type: 'fields', req: 'required',
          fields: [
            { key: 'name', label: '성함' }, { key: 'title', label: '직책' },
            { key: 'consent', label: '적어주신 정보를 마케팅 업무에만 사용하는 데 동의합니다.', type: 'check' },
          ],
          complete: v => isObj(v) && !!str(v.name) && !!str(v.title) && v.consent === true,
        },
      ],
    },
    {
      title: '환자분들 이야기',
      questions: [
        { id: '3-03', label: '최근 1년, 처음 오신 분이 가장 많이 찾은 진료 1~3순위', type: 'rank', feel: true, req: 'required' },
        { id: '3-04', label: '다시 오시거나 지인을 소개해 오시는 분이 많은 진료 1~3순위 (둘 중 하나라도)', type: 'rank', req: 'required' },
        { id: '3-04-1', label: '컴플레인이 잦은 진료', type: 'pick', extras: ['없음', '모름'], req: 'recommended' },
        { id: '3-09', label: '환자분들이 우리 병원을 선택한 이유로 뭐라고 하세요?', type: 'long', req: 'required' },
        { id: '5-01', label: '소개로 오신 분은 어떤 이야기를 듣고 오셨다고 하세요?', type: 'long', req: 'recommended' },
        { id: '5-02', label: '오시기 전에 어느 병원을 다녀왔다고 하세요? 진료별로 병원 이름을 적어주세요.', type: 'text', repeat: 'treatment', req: 'recommended' },
        { id: '5-03', label: '주로 오시는 환자분 연령대', type: 'multi', options: ['10대 이하', '20대', '30대', '40대', '50대', '60대', '70대 이상'], req: 'recommended' },
        {
          id: '5-04', label: '근처에 사시는 분과 근처에서 일하시는 분 중 어느 쪽이 많으세요?', type: 'single', req: 'recommended',
          options: ['사시는 분', '일하시는 분', '비슷함', '둘 다 아님(멀리서 오심)', '모름'],
        },
        { id: '5-05', label: '환자분들이 어떻게 오게 됐다고 하세요? (검색, 소개, 지나가다 등)', type: 'long' },
        { id: '3-13', label: '환자가 상담 전에 가장 자주 묻거나 걱정하는 것 3가지', type: 'long', req: 'recommended' },
      ],
    },
  ],
};

export const SURVEYS: Record<Kind, SurveyDef> = { owner: OWNER, counsel: COUNSEL };

/* ── 계산 ── */

export function optionsOf(q: Question, a: Answers): string[] {
  return typeof q.options === 'function' ? q.options(a) : q.options ?? [];
}

export function reqOf(q: Question, a: Answers, inst: string | null): Req | undefined {
  return typeof q.req === 'function' ? q.req(a, inst) : q.req;
}

/** 반복 묶음의 이름 목록. 반복이 아니면 null */
export function instancesOf(q: Question, a: Answers, ctx: Ctx): string[] | null {
  switch (q.repeat) {
    case 'treatment': return ctx.treatments;
    case 'treatment-cf': {
      const cf = confidentOf(a, ctx);
      return [...cf, ...ctx.treatments.filter(t => !cf.includes(t))];
    }
    case 'confident': return confidentOf(a, ctx);
    case 'doctor': { const d = chosenDoctors(a); return d.length ? d : ['대표원장']; }
    case 'doctor-opt': { const d = chosenDoctors(a); return d.length ? d : null; }
    default: return null;
  }
}

export function valueOf(q: Question, a: Answers, inst: string | null): unknown {
  return inst === null ? a[q.id] : perInst(a, q.id, inst);
}

export function isEmpty(q: Question, v: unknown): boolean {
  if (v === undefined || v === null) return true;
  switch (q.type) {
    case 'check': return v !== true;
    case 'list': case 'multi': case 'pick': return strs(v).length === 0;
    case 'table': return tableRows(v).length === 0;
    case 'rank': return !isObj(v) || (v.unknown !== true && !['r1', 'r2', 'r3'].some(k => strs(v[k]).length));
    case 'fields': return !isObj(v) || !(q.fields ?? []).some(f => (f.type === 'check' ? v[f.key] === true : !!str(v[f.key])));
    default: return !str(v);
  }
}

/** 계정 칸이 채워졌는지(값은 내보내지 않는다) */
export function secretsFilled(s: Record<string, unknown>): Record<string, boolean> {
  const pair = (v: unknown) => isObj(v) && !!str(v.id) && !!str(v.pw);
  const v2 = s['1-02'];
  return {
    '1-01': pair(s['1-01']),
    '1-02': pair(v2) || (isObj(v2) && v2.same === true),
    '1-03': pair(s['1-03']),
    '1-04': !!str(s['1-04']),
  };
}

export interface Item {
  page: number;
  q: Question;
  inst: string | null;
  req: Req | undefined;
  answered: boolean;
}

/** 지금 답 기준으로 보이는 문항(반복 묶음은 이름마다 한 줄). 자료 올리기 버튼은 뺀다 */
export function visibleItems(kind: Kind, a: Answers, ctx: Ctx, filled: Record<string, boolean> = {}): Item[] {
  const out: Item[] = [];
  SURVEYS[kind].pages.forEach((p, page) => {
    for (const q of p.questions) {
      if (q.type === 'upload') continue;
      for (const inst of instancesOf(q, a, ctx) ?? [null]) {
        if (q.when && !q.when(a, ctx, inst)) continue;
        const v = valueOf(q, a, inst);
        const answered = q.secret ? !!filled[q.id] : !isEmpty(q, v) && (q.complete ? q.complete(v) : true);
        out.push({ page, q, inst, req: reqOf(q, a, inst), answered });
      }
    }
  });
  return out;
}

export type PageState = 'empty' | 'partial' | 'done';

/** 목차의 작성 상태: 안 씀 / 쓰는 중 / 다 씀(필수·권장을 모두 채움) */
export function pageStates(kind: Kind, items: Item[]): PageState[] {
  return SURVEYS[kind].pages.map((_p, i) => {
    const mine = items.filter(it => it.page === i);
    if (!mine.some(it => it.answered)) return 'empty';
    return mine.some(it => it.req && !it.answered) ? 'partial' : 'done';
  });
}

/** 제출을 막는 빈 필수 문항 */
export function missingRequired(items: Item[]): Item[] {
  return items.filter(it => it.req === 'required' && !it.answered);
}

export function consentGiven(kind: Kind, a: Answers): boolean {
  const v = a[SURVEYS[kind].consentId];
  return kind === 'owner' ? v === true : isObj(v) && v.consent === true;
}

/** 서버 저장 전: 이 설문의 문항 ID만 남기고, 계정 문항은 뺀다 */
export function sanitizeAnswers(kind: Kind, raw: unknown): Answers {
  const out: Answers = {};
  if (!isObj(raw)) return out;
  for (const p of SURVEYS[kind].pages) {
    for (const q of p.questions) {
      if (!q.secret && q.type !== 'upload' && raw[q.id] !== undefined) out[q.id] = raw[q.id];
    }
  }
  return out;
}

/* ── JSON 복사 (모양 sb-survey/1) ── */

function fieldsOut(fields: Field[], v: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === 'check') { if (v[f.key] === true) o[f.key] = true; }
    else if (str(v[f.key])) o[f.key] = str(v[f.key]);
  }
  return o;
}

/** 값 하나를 내보낼 모양으로 다듬는다(지워진 진료·보기 정리) */
function clean(q: Question, v: unknown, a: Answers, ctx: Ctx): unknown {
  switch (q.type) {
    case 'check': return true;
    case 'list': return uniq(strs(v));
    case 'multi': { const opts = optionsOf(q, a); return strs(v).filter(x => opts.includes(x)); }
    case 'pick': return strs(v).filter(x => ctx.treatments.includes(x) || (q.extras ?? []).includes(x));
    case 'rank': {
      const r = v as Record<string, unknown>;
      const pick = (k: string) => strs(r[k]).filter(x => ctx.treatments.includes(x));
      return { r1: pick('r1'), r2: pick('r2'), r3: pick('r3'), unknown: r.unknown === true, ...(q.feel ? { feel: r.feel === true } : {}) };
    }
    case 'table': return tableRows(v).map(r => fieldsOut(q.fields ?? [], r));
    case 'fields': return fieldsOut(q.fields ?? [], v as Record<string, unknown>);
    default: return str(v);
  }
}

/** 보이는 문항 중 채운 것만 문항 ID 키로 모은다. 계정 문항은 넣지 않는다 */
export function exportAnswers(kind: Kind, a: Answers, ctx: Ctx): Answers {
  const out: Answers = {};
  for (const it of visibleItems(kind, a, ctx)) {
    if (it.q.secret) continue;
    const raw = valueOf(it.q, a, it.inst);
    if (isEmpty(it.q, raw)) continue;
    const v = clean(it.q, raw, a, ctx);
    if (isEmpty(it.q, v)) continue;
    if (it.inst === null) out[it.q.id] = v;
    else out[it.q.id] = { ...(out[it.q.id] as Record<string, unknown> | undefined), [it.inst]: v };
  }
  return out;
}

export interface SurveySide {
  status: 'none' | 'draft' | 'submitted';
  submittedAt: string | null;
  answers: Answers;
}

/** 한국 시각(+09:00)으로 쓴 ISO 글자 */
export function toKst(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : new Date(t + 9 * 3600_000).toISOString().slice(0, 19) + '+09:00';
}

export function buildExport(branch: { id: string; name: string }, owner: SurveySide | null, counsel: SurveySide | null) {
  const ctx: Ctx = { treatments: treatmentsOf(owner?.answers ?? {}) };
  const side = (kind: Kind, s: SurveySide | null) => ({
    status: s?.status ?? 'none',
    submittedAt: toKst(s?.submittedAt ?? null),
    answers: s ? exportAnswers(kind, s.answers, ctx) : {},
  });
  return { schema: 'sb-survey/1', branch: { id: branch.id, name: branch.name }, owner: side('owner', owner), counsel: side('counsel', counsel) };
}

/** 관리자 열람용: 값을 읽기 쉬운 글로 */
export function formatValue(v: unknown): string {
  if (v === true) return '예';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(formatValue).filter(Boolean).join(v.some(isObj) ? '\n' : ', ');
  if (isObj(v)) {
    if ('r1' in v) {
      const parts = ['r1', 'r2', 'r3'].map((k, i) => (strs(v[k]).length ? `${i + 1}순위 ${strs(v[k]).join('·')}` : '')).filter(Boolean);
      if (v.unknown === true) parts.push('모름');
      if (v.feel === true) parts.push('(체감으로 적음)');
      return parts.join(' / ');
    }
    return Object.entries(v).map(([k, x]) => `${k}: ${formatValue(x)}`).join(' / ');
  }
  return '';
}
