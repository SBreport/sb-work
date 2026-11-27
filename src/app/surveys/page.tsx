'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import Spinner from '@/components/Spinner';
import { SURVEYS, formatValue, treatmentsOf, valueOf, visibleItems, type Answers, type Kind } from '@/lib/survey';

// 병원 사전 설문 — 직원 화면(admin·editor·employee). 링크 생성·복사, 병원 단위 목록, 응답 열람, JSON 복사.
// 사이드바 공통 메뉴 「설문」. 프리랜서·협력사는 공지사항으로 돌려보낸다(API도 requireStaff로 막는다).

interface Link {
  id: string; branch_id: string; kind: Kind; token: string; nas_url: string | null;
  expires_at: string; status: 'none' | 'draft' | 'submitted';
}
interface ListData {
  branches: { id: string; name: string; status: string }[];
  links: Link[];
  times: { link_id: string; saved_at: string | null; submitted_at: string | null }[];
}
interface Side { link: Link; status: Link['status']; submittedAt: string | null; savedAt: string | null; consentAt: string | null; answers: Answers }
interface Detail { branch: { id: string; name: string }; owner: Side | null; counsel: Side | null; export: unknown }

const KIND_LABEL: Record<Kind, string> = { owner: '원장용', counsel: '실장용' };
const STATUS_LABEL = { none: '작성 전', draft: '임시 저장', submitted: '제출' } as const;
const STATUS_STYLE = { none: 'bg-gray-100 text-gray-600', draft: 'bg-amber-50 text-amber-700', submitted: 'bg-green-50 text-green-700' } as const;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '');
const expired = (l: Link) => new Date(l.expires_at).getTime() < Date.now();
const BTN = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40';
const INPUT = 'rounded-lg border border-gray-300 px-3 py-2 text-sm';

export default function AdminSurveysPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const isStaff = !!profile && ['admin', 'editor', 'employee'].includes(profile.role);
  useEffect(() => { if (!loading && profile && !isStaff) router.replace('/notices'); }, [loading, profile, isStaff, router]);
  const [list, setList] = useState<ListData | null>(null);
  const [branchId, setBranchId] = useState('');
  const [branchQuery, setBranchQuery] = useState('');
  const [nasUrl, setNasUrl] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [secrets, setSecrets] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('');

  const call = useCallback(async (url: string, init?: RequestInit) => {
    const res = await authFetch(url, init?.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json.error || '요청이 실패했습니다.'); return null; }
    return json;
  }, []);

  const loadList = useCallback(async () => {
    const json = await call('/api/surveys');
    if (json) setList(json);
  }, [call]);

  const openDetail = useCallback(async (id: string) => {
    setSecrets(null);
    const json = await call(`/api/surveys?branch=${id}`);
    if (json) setDetail(json);
  }, [call]);

  useEffect(() => {
    authFetch('/api/surveys')
      .then(async res => (res.ok ? setList(await res.json()) : setMessage((await res.json().catch(() => ({}))).error || '목록을 불러오지 못했습니다.')))
      .catch(() => setMessage('목록을 불러오지 못했습니다.'));
  }, []);

  const copy = async (text: string, what: string) => {
    setMessage(''); // 실패했는데 이전 「복사했습니다」가 남으면 다른 링크를 붙여 보내게 된다
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${what} 복사했습니다.`);
    } catch {
      setMessage(`${what} 복사하지 못했습니다. 이 창을 한 번 누른 뒤 다시 시도해 주세요.`);
    }
  };

  const create = async () => {
    setMessage('');
    if (await call('/api/surveys', { method: 'POST', body: JSON.stringify({ branchId, nasUrl }) })) {
      setMessage('원장용·실장용 링크를 만들었습니다. 아래 목록에서 복사하세요.');
      setNasUrl('');
      setBranchId('');
      setBranchQuery('');
      await loadList();
    }
  };

  const patch = async (body: object) => {
    setMessage('');
    if (await call('/api/surveys', { method: 'PATCH', body: JSON.stringify(body) }) && detail) {
      await Promise.all([loadList(), openDetail(detail.branch.id)]);
    }
  };

  const remove = async () => {
    if (!detail || !window.confirm(`${detail.branch.name}의 설문 링크·답·계정 정보를 모두 지웁니다. 되돌릴 수 없습니다. 지울까요?`)) return;
    if (await call(`/api/surveys?branch=${detail.branch.id}`, { method: 'DELETE' })) {
      setDetail(null);
      setMessage('지웠습니다.');
      await loadList();
    }
  };

  if (!list) return <div className="p-6">{message ? <p className="text-sm text-red-600">{message}</p> : <Spinner />}</div>;

  const byBranch = new Map<string, Partial<Record<Kind, Link>>>();
  for (const l of list.links) byBranch.set(l.branch_id, { ...byBranch.get(l.branch_id), [l.kind]: l });
  const nameOf = (id: string) => list.branches.find(b => b.id === id)?.name ?? '(지워진 지점)';
  const timeOf = (l: Link) => list.times.find(t => t.link_id === l.id);
  const url = (l: Link) => `${window.location.origin}/survey/${l.token}`;
  // 설문 요청 카톡 — 문구 원본은 sb-marketing-system 「12 카톡문구」의 `설문요청`. 그쪽을 고치면 여기도 같이 고친다.
  const kakao = (branch: string, owner: Link, counsel: Link) => [
    `원장님, 안녕하세요. ${branch} 마케팅을 맡게 된 ${profile?.name ?? ''}입니다.`,
    '본격적으로 시작하기 전에 병원을 정확히 이해하려고 사전 설문을 부탁드립니다. 링크는 두 개입니다.',
    `· 원장님용: ${url(owner)}\n· 상담을 가장 많이 맡으시는 분용(10분 정도): ${url(counsel)}`,
    "두 설문은 따로 쓰시면 되고 순서는 상관없습니다. 원장님용은 한 번에 다 쓰지 않으셔도 됩니다. 적는 대로 저장되고 같은 링크로 이어서 쓰실 수 있습니다. 모르시는 칸은 '모름'을 골라 주세요.",
    `계정 정보는 마케팅 업무에만 쓰고, 담당 팀만 열람합니다.${owner.nas_url ? ' 자격증·인증서 같은 자료는 설문 안의 「자료 올리기」로 올려 주시면 됩니다.' : ''} 감사합니다.`,
  ].join('\n\n');

  const linkCell = (l: Link | undefined) => {
    if (!l) return <td className="px-3 py-2 text-sm text-gray-400">없음</td>;
    const t = timeOf(l);
    return (
      <td className="px-3 py-2 text-sm">
        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[l.status]}`}>{STATUS_LABEL[l.status]}</span>
        <span className="ml-2 text-xs text-gray-500">
          {l.status === 'submitted' ? `${day(t?.submitted_at ?? null)} 제출` : expired(l) ? '기간 지남' : `~${day(l.expires_at)}`}
        </span>
        <button type="button" className="ml-2 text-xs text-blue-600 underline" onClick={() => copy(url(l), `${KIND_LABEL[l.kind]} 링크를`)}>링크 복사</button>
      </td>
    );
  };

  const sideView = (kind: Kind, side: Side | null, ctx: { treatments: string[] }) => {
    if (!side) return null;
    const items = visibleItems(kind, side.answers, ctx).filter(it => !it.q.secret && it.answered);
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-gray-900">{KIND_LABEL[kind]}</h3>
          <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[side.status]}`}>{STATUS_LABEL[side.status]}</span>
          <span className="text-xs text-gray-500">
            {side.submittedAt ? `제출 ${day(side.submittedAt)}` : side.savedAt ? `저장 ${day(side.savedAt)}` : ''}
            {side.consentAt ? ` · 동의 ${day(side.consentAt)}` : ''} · 만료 {day(side.link.expires_at)}
          </span>
          {(side.status === 'submitted' || expired(side.link)) && (
            <button type="button" className={BTN} onClick={() => patch({ linkId: side.link.id, action: 'reopen' })}>
              {side.status === 'submitted' ? '다시 열기' : '기간 30일 늘리기'}
            </button>
          )}
          {kind === 'owner' && (
            <button type="button" className={BTN} onClick={() => {
              const next = window.prompt('NAS 업로드 주소 (https://… , 비우면 버튼 숨김)', side.link.nas_url ?? '');
              if (next !== null) void patch({ linkId: side.link.id, action: 'nas', nasUrl: next });
            }}>
              NAS 주소 {side.link.nas_url ? '바꾸기' : '넣기'}
            </button>
          )}
        </div>
        {!items.length && <p className="text-sm text-gray-500">아직 적은 답이 없습니다.</p>}
        {SURVEYS[kind].pages.map((p, i) => {
          const mine = items.filter(it => it.page === i);
          if (!mine.length) return null;
          return (
            <div key={p.title} className="rounded-lg border border-gray-200 p-3">
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{p.title}</h4>
              <dl className="space-y-2">
                {mine.map(it => (
                  <div key={`${it.q.id}:${it.inst ?? ''}`}>
                    <dt className="text-xs text-gray-500">{it.q.id} · {it.q.label}{it.inst ? ` — ${it.inst}` : ''}</dt>
                    <dd className="whitespace-pre-wrap text-sm text-gray-900">{formatValue(valueOf(it.q, side.answers, it.inst))}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </section>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-gray-900">병원 사전 설문</h1>
      {message && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800" role="status">{message}</p>}

      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="relative text-sm text-gray-700">
          <span className="mb-1 block text-xs text-gray-500">지점</span>
          <input className={`${INPUT} w-64`} type="search" placeholder="지점 이름 일부를 입력" autoComplete="off" value={branchQuery}
            onChange={e => { setBranchQuery(e.target.value); setBranchId(''); }} />
          {/* 후보는 입력 칸 아래에 띄운다(자리를 차지하지 않아 틀이 안 움직임). 고르기 전에만 보여 준다 — 이름 일부가 들어 있는 지점(해지·이미 링크 있는 지점 제외) */}
          {branchQuery.trim() && !branchId && (() => {
            const q = branchQuery.trim().toLowerCase();
            const hits = list.branches.filter(b => b.status !== 'terminated' && !byBranch.has(b.id) && b.name.toLowerCase().includes(q));
            return hits.length ? (
              <ul className="absolute left-0 top-full z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {hits.slice(0, 20).map(b => (
                  <li key={b.id}>
                    <button type="button" className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-blue-50"
                      onClick={() => { setBranchId(b.id); setBranchQuery(b.name); }}>{b.name}</button>
                  </li>
                ))}
              </ul>
            ) : <p className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500 shadow-lg">맞는 지점이 없습니다. 이미 링크를 만든 지점은 아래 목록에 있습니다.</p>;
          })()}
        </label>
        <label className="min-w-64 flex-1 text-sm text-gray-700">
          <span className="mb-1 block text-xs text-gray-500">NAS 업로드 주소 (선택 — https:// 로 시작. 비우면 「자료 올리기」 버튼이 숨는다)</span>
          <input className={`${INPUT} w-full`} type="url" placeholder="https://" value={nasUrl} onChange={e => setNasUrl(e.target.value)} />
        </label>
        <button type="button" disabled={!branchId} onClick={create} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          링크 만들기
        </button>
      </section>

      <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="px-3 py-2">병원(지점)</th><th className="px-3 py-2">원장용</th><th className="px-3 py-2">실장용</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {[...byBranch.entries()].map(([id, pair]) => (
              <tr key={id} className="border-b border-gray-100">
                <td className="px-3 py-2 text-sm font-medium text-gray-900">{nameOf(id)}</td>
                {linkCell(pair.owner)}
                {linkCell(pair.counsel)}
                <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                  {pair.owner && pair.counsel && (
                    <button type="button" className={BTN} onClick={() => copy(kakao(nameOf(id), pair.owner!, pair.counsel!), '카톡 문구를')}>카톡 문구 복사</button>
                  )}
                  <button type="button" className={BTN} onClick={() => openDetail(id)}>응답 보기</button>
                </td>
              </tr>
            ))}
            {!byBranch.size && <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">아직 만든 설문 링크가 없습니다.</td></tr>}
          </tbody>
        </table>
      </section>

      {detail && (
        <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-bold text-gray-900">{detail.branch.name}</h2>
            <button type="button" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
              onClick={() => copy(JSON.stringify(detail.export, null, 2), 'JSON을')}>
              JSON 복사
            </button>
            <button type="button" className={BTN} onClick={async () => {
              if (secrets) return setSecrets(null);
              const json = await call(`/api/surveys?branch=${detail.branch.id}&secrets=1`);
              if (json) setSecrets(json.secrets);
            }}>
              계정 정보 {secrets ? '가리기' : '보기'}
            </button>
            {profile?.role === 'admin' && <button type="button" className={`${BTN} text-red-600`} onClick={remove}>응답 삭제</button>}
            <button type="button" className={BTN} onClick={() => setDetail(null)}>닫기</button>
          </div>

          {secrets && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-gray-900">
              <p className="mb-2 text-xs text-amber-800">계정 정보 — 「JSON 복사」에는 들어가지 않습니다. 다른 곳에 옮겨 적지 마세요.</p>
              {SURVEYS.owner.pages.flatMap(p => p.questions).filter(q => q.secret).map(q => (
                <p key={q.id}><span className="text-xs text-gray-500">{q.id} · {q.label}: </span>{formatValue(secrets[q.id]) || '(없음)'}</p>
              ))}
            </div>
          )}

          {sideView('owner', detail.owner, { treatments: treatmentsOf(detail.owner?.answers ?? {}) })}
          {sideView('counsel', detail.counsel, { treatments: treatmentsOf(detail.counsel?.answers ?? {}, 'counsel') })}
        </section>
      )}
    </div>
  );
}
