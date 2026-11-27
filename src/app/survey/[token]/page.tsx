'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import SurveyField from '@/components/SurveyField';
import { FullPageSpinner } from '@/components/Spinner';
import {
  SURVEYS, consentGiven, instancesOf, missingRequired, pageStates, reqOf, secretsFilled, treatmentsOf, valueOf, visibleItems,
  type Answers, type Ctx, type Kind, type PageState, type Question,
} from '@/lib/survey';

// 병원 사전 설문 — 작성자 화면. 로그인 없이 링크의 토큰으로 자기 답만 읽고 쓴다.

interface Loaded {
  kind: Kind;
  status: 'none' | 'draft' | 'submitted';
  branchName: string;
  nasUrl: string | null;
  treatments: string[];
}

const STATE_LABEL: Record<PageState, string> = { empty: '안 씀', partial: '쓰는 중', done: '다 씀' };
const STATE_STYLE: Record<PageState, string> = { empty: 'text-gray-400', partial: 'text-amber-600', done: 'text-green-600' };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{body}</p>
      </div>
    </div>
  );
}

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<'not_found' | 'expired' | 'network' | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [secrets, setSecrets] = useState<Record<string, unknown>>({}); // 이번에 새로 적은 계정 칸(서버에서 되받지 않는다)
  const [serverFilled, setServerFilled] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ page: number; label: string }[]>([]);

  const answersRef = useRef<Answers>({});
  const secretsRef = useRef<Record<string, unknown>>({});
  const dirty = useRef(false);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readOnly = useRef(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/survey/${token}`)
      .then(async res => {
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) return setLoadError(json.error === 'expired' ? 'expired' : json.error === 'not_found' ? 'not_found' : 'network');
        answersRef.current = json.answers ?? {};
        readOnly.current = json.status === 'submitted';
        setAnswers(json.answers ?? {});
        setServerFilled(json.secretsFilled ?? {});
        setSavedAt(json.savedAt);
        setLoaded({ kind: json.kind, status: json.status, branchName: json.branchName, nasUrl: json.nasUrl, treatments: json.treatments ?? [] });
      })
      .catch(() => alive && setLoadError('network'));
    return () => { alive = false; };
  }, [token]);

  /** 저장. 이미 저장 중이면 끝난 뒤 한 번 더 보낸다 */
  const save = useCallback(async (opts: { submit?: boolean; closing?: boolean } = {}): Promise<{ ok: boolean; ids?: string[] }> => {
    if (readOnly.current) return { ok: false };
    if (timer.current) clearTimeout(timer.current);
    while (inflight.current) await inflight.current;
    if (!dirty.current && !opts.submit) return { ok: true };
    dirty.current = false;
    setSaveState('saving');
    const body = JSON.stringify({ answers: answersRef.current, secrets: secretsRef.current, submit: opts.submit === true });
    let result: { ok: boolean; ids?: string[] } = { ok: false };
    const run = (async () => {
      try {
        // keepalive: 창을 닫는 중에도 요청이 끝까지 가게 한다(브라우저 한도 64KB)
        const res = await fetch(`/api/survey/${token}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
          keepalive: opts.closing === true && body.length < 60_000,
        });
        const json = await res.json();
        if (res.status === 409) { readOnly.current = true; setLoaded(l => l && { ...l, status: 'submitted' }); }
        if (!res.ok) { result = { ok: false, ids: json.ids }; throw new Error(json.error); }
        setServerFilled(json.secretsFilled ?? {});
        setSavedAt(json.savedAt);
        setSaveState('saved');
        if (json.status === 'submitted') { readOnly.current = true; setLoaded(l => l && { ...l, status: 'submitted' }); }
        result = { ok: true };
      } catch {
        dirty.current = true;
        setSaveState('error');
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
    return result;
  }, [token]);

  const touch = useCallback(() => {
    dirty.current = true;
    setProblems([]);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, 2000); // 입력을 멈추고 2초 뒤
  }, [save]);

  // 창을 닫거나 다른 탭으로 갈 때
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void save({ closing: true }); };
    const leave = () => { void save({ closing: true }); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', leave);
    };
  }, [save]);

  const ctx: Ctx = useMemo(() => ({
    treatments: loaded?.kind === 'counsel' ? loaded.treatments : treatmentsOf(answers),
    nasUrl: loaded?.nasUrl,
  }), [loaded, answers]);

  if (loadError === 'not_found') return <Notice title="링크를 찾을 수 없습니다" body="주소가 정확한지 확인해주세요. 계속 열리지 않으면 담당자에게 알려주세요." />;
  if (loadError === 'expired') return <Notice title="링크 기간이 지났습니다" body="이 설문 링크는 사용 기간(30일)이 끝났습니다. 담당자에게 알려주시면 다시 열어드립니다." />;
  if (loadError) return <Notice title="설문을 불러오지 못했습니다" body="인터넷 연결을 확인한 뒤 새로 고침해주세요." />;
  if (!loaded) return <FullPageSpinner />;

  const { kind } = loaded;
  const def = SURVEYS[kind];
  const submitted = loaded.status === 'submitted';
  const draftFilled = secretsFilled(secrets);
  const filled = Object.fromEntries(Object.keys(draftFilled).map(k => [k, serverFilled[k] || draftFilled[k]]));
  const items = visibleItems(kind, answers, ctx, filled);
  const states = pageStates(kind, items);
  const consented = consentGiven(kind, answers);
  const last = page === def.pages.length - 1;

  const setValue = (q: Question, inst: string | null, v: unknown) => {
    if (q.secret) {
      secretsRef.current = { ...secretsRef.current, [q.id]: v };
      setSecrets(secretsRef.current);
    } else {
      const old = answersRef.current[q.id];
      answersRef.current = { ...answersRef.current, [q.id]: inst === null ? v : { ...(isObj(old) ? old : {}), [inst]: v } };
      setAnswers(answersRef.current);
    }
    touch();
  };

  const go = (next: number) => {
    if (next > 0 && !consented) return;
    void save(); // 페이지를 옮길 때
    setPage(next);
    window.scrollTo(0, 0);
  };

  const submit = async () => {
    const missing = missingRequired(items);
    if (missing.length) {
      return setProblems(missing.map(m => ({ page: m.page, label: `${def.pages[m.page].title} — ${m.q.label}${m.inst ? ` (${m.inst})` : ''}` })));
    }
    if (!window.confirm('제출하면 더 고칠 수 없습니다. 제출할까요?')) return;
    const res = await save({ submit: true });
    if (!res.ok && res.ids) setProblems(res.ids.map(id => ({ page: 0, label: `필수 문항 ${id}` })));
  };

  const renderQuestion = (q: Question, inst: string | null) => {
    if (q.when && !q.when(answers, ctx, inst)) return null;
    const req = reqOf(q, answers, inst);
    // 이번에 적고 있는 계정 칸은 가리지 않는다(자동 저장이 입력 도중에 칸을 가리지 않게). 다시 열면 가려진다.
    const masked = q.secret && serverFilled[q.id] && !editing[q.id] && !(q.id in secrets);
    return (
      <div key={`${q.id}:${inst ?? ''}`} className="space-y-2">
        {q.type !== 'check' && (
          <div className="text-sm font-medium text-gray-900">
            {q.label}
            {req === 'required' && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-normal text-red-600">필수</span>}
            {req === 'recommended' && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-normal text-blue-600">권장</span>}
          </div>
        )}
        {q.hint && <p className="text-xs text-gray-500">{q.hint}</p>}
        {masked ? (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>저장됨 ●●●●●●</span>
            {!submitted && (
              <button type="button" className="text-blue-600 underline" onClick={() => setEditing(e => ({ ...e, [q.id]: true }))}>다시 입력</button>
            )}
          </div>
        ) : (
          <SurveyField q={q} value={q.secret ? secrets[q.id] : valueOf(q, answers, inst)} onChange={v => setValue(q, inst, v)}
            answers={answers} ctx={ctx} disabled={submitted} />
        )}
        {q.type === 'check' && req === 'required' && <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">필수</span>}
      </div>
    );
  };

  /** 이웃한 같은 반복 묶음 문항은 이름(진료·원장)마다 한 상자로 모은다 */
  const renderPage = () => {
    const out: React.ReactNode[] = [];
    const qs = def.pages[page].questions;
    for (let i = 0; i < qs.length;) {
      const q = qs[i];
      const insts = instancesOf(q, answers, ctx);
      if (!q.repeat || insts === null) { out.push(renderQuestion(q, null)); i++; continue; }
      let j = i;
      while (j < qs.length && qs[j].repeat === q.repeat) j++;
      const group = qs.slice(i, j).filter(g => !g.when || insts.some(inst => g.when!(answers, ctx, inst)));
      i = j;
      if (!group.length) continue;
      if (!insts.length) {
        out.push(
          <p key={`${q.id}:none`} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {q.repeat === 'confident' ? '위에서 자신 있는 진료를 고르면 그 진료에 대한 질문이 나타납니다.' : '「진료와 순위」 페이지에서 주요 진료를 먼저 적어주세요.'}
          </p>,
        );
        continue;
      }
      for (const inst of insts) {
        out.push(
          <section key={`${q.id}:${inst}`} className="space-y-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-bold text-blue-700">{inst}</h3>
            {group.map(g => renderQuestion(g, inst))}
          </section>,
        );
      }
    }
    return out;
  };

  const toc = def.pages.map((p, i) => (
    <button key={p.title} type="button" disabled={i > 0 && !consented} onClick={() => go(i)} aria-current={i === page ? 'page' : undefined}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-40 ${i === page ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}>
      <span>{i + 1}. {p.title}</span>
      <span className={`shrink-0 text-xs ${STATE_STYLE[states[i]]}`}>{STATE_LABEL[states[i]]}</span>
    </button>
  ));

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <header className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <h1 className="text-base font-bold text-gray-900">{def.title}</h1>
          <p className="text-xs text-gray-500">{loaded.branchName}</p>
        </div>
        {!submitted && (
          <div className="flex items-center gap-3" aria-live="polite">
            {saveState === 'error' ? (
              <span className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">저장 안 됨 — 연결 확인</span>
            ) : (
              <span className="text-xs text-gray-500">
                {saveState === 'saving' ? '저장 중…' : savedAt ? `저장됨 · ${timeOf(savedAt)}` : '아직 저장한 내용이 없습니다'}
              </span>
            )}
            <button type="button" className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => { dirty.current = true; void save(); }}>
              저장
            </button>
          </div>
        )}
      </header>

      {submitted && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">제출되었습니다. 감사합니다. 고칠 내용이 있으면 담당자에게 알려주세요.</p>}
      {kind === 'counsel' && !ctx.treatments.length && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          원장님 설문의 주요 진료가 먼저 필요합니다. 원장님이 「진료와 순위」를 적으신 뒤 이 링크를 다시 열어주세요. 그 전에도 글로 적는 문항은 미리 쓰실 수 있습니다.
        </p>
      )}

      <div className="mt-4 gap-6 md:flex">
        <details className="mb-4 rounded-xl border border-gray-200 bg-white p-2 md:hidden">
          <summary className="cursor-pointer px-2 py-1 text-sm font-medium text-gray-800">목차 — {page + 1}. {def.pages[page].title}</summary>
          <nav className="mt-2 space-y-1">{toc}</nav>
        </details>
        <nav className="sticky top-20 hidden w-56 shrink-0 space-y-1 self-start md:block" aria-label="목차">{toc}</nav>

        {/* 다른 칸으로 넘어갈 때 저장 */}
        <main className="min-w-0 flex-1 space-y-6 rounded-xl border border-gray-200 bg-white p-5" onBlurCapture={() => { void save(); }}>
          <h2 className="text-lg font-bold text-gray-900">{def.pages[page].title}</h2>
          {def.pages[page].note && <p className="text-sm text-gray-600">{def.pages[page].note}</p>}
          {page === 0 && (
            <>
              <p className="text-sm text-gray-700">{def.intro[0]}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {def.intro.slice(1).map(line => <li key={line}>{line}</li>)}
              </ul>
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <p className="mb-2 font-semibold text-gray-900">개인정보 수집·이용 안내</p>
                <ul className="list-disc space-y-1 pl-5">{def.consent.map(line => <li key={line}>{line}</li>)}</ul>
              </div>
            </>
          )}
          {renderPage()}

          {problems.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              <p className="font-semibold">아직 비어 있는 필수 문항이 있습니다.</p>
              <ul className="mt-1 list-disc pl-5">
                {problems.map(p => <li key={p.label}><button type="button" className="text-left underline" onClick={() => go(p.page)}>{p.label}</button></li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <button type="button" disabled={page === 0} onClick={() => go(page - 1)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-40">이전</button>
            {!last && (
              <button type="button" disabled={!consented} onClick={() => go(page + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                {page === 0 && !consented ? '동의해야 다음으로 넘어갑니다' : '다음'}
              </button>
            )}
            {last && !submitted && (
              <button type="button" onClick={() => { void submit(); }} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">제출</button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
