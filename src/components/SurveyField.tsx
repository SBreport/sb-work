'use client';

import { optionsOf, type Answers, type Ctx, type Field, type Question } from '@/lib/survey';
import { Plus, X } from 'lucide-react';

// 병원 사전 설문의 입력 칸 하나. 문항 정의(src/lib/survey.ts)의 type에 따라 그린다.

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500';
const CHIP = 'rounded-full border px-3 py-1 text-sm disabled:opacity-60';
const chip = (on: boolean) => `${CHIP} ${on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'}`;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter(y => y !== x) : [...list, x]);

interface Props {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  answers: Answers;
  ctx: Ctx;
  disabled: boolean;
}

function Cell({ f, value, onChange, disabled }: { f: Field; value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  if (f.type === 'check') {
    return (
      <label className="flex items-start gap-2 text-sm text-gray-800">
        <input type="checkbox" className="mt-0.5" checked={value === true} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        {f.label}
      </label>
    );
  }
  if (f.type === 'single') {
    return (
      <select className={INPUT} aria-label={f.label} value={text(value)} disabled={disabled} onChange={e => onChange(e.target.value)}>
        <option value="">{f.label}</option>
        {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === 'long') {
    return <textarea className={INPUT} rows={3} aria-label={f.label} placeholder={f.label} value={text(value)} disabled={disabled} onChange={e => onChange(e.target.value)} />;
  }
  return (
    <input
      className={INPUT}
      type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : 'text'}
      autoComplete="off"
      min={f.type === 'number' ? 0 : undefined}
      aria-label={f.label}
      placeholder={f.label}
      value={text(value)}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
    />
  );
}

const needTreatments = (ctx: Ctx) => (ctx.kind === 'counsel' ? '위에 주요 진료를 먼저 적어주세요.' : '「진료와 순위」 페이지에서 주요 진료를 먼저 적어주세요.');

export default function SurveyField({ q, value, onChange, answers, ctx, disabled }: Props) {
  switch (q.type) {
    case 'long':
      return <textarea className={INPUT} rows={4} value={text(value)} disabled={disabled} onChange={e => onChange(e.target.value)} />;

    case 'check':
      return (
        <label className="flex items-start gap-2 text-sm font-medium text-gray-900">
          <input type="checkbox" className="mt-0.5" checked={value === true} disabled={disabled} onChange={e => onChange(e.target.checked)} />
          {q.label}
        </label>
      );

    case 'single':
      return (
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {optionsOf(q, answers).map(o => (
            <button key={o} type="button" role="radio" aria-checked={value === o} className={chip(value === o)} disabled={disabled}
              onClick={() => onChange(value === o ? '' : o)}>
              {o}
            </button>
          ))}
        </div>
      );

    case 'multi':
      return (
        <div className="flex flex-wrap gap-2">
          {optionsOf(q, answers).map(o => (
            <button key={o} type="button" aria-pressed={arr(value).includes(o)} className={chip(arr(value).includes(o))} disabled={disabled}
              onClick={() => onChange(toggle(arr(value), o))}>
              {o}
            </button>
          ))}
        </div>
      );

    case 'list': {
      const list = Array.from({ length: q.max ?? 5 }, (_, i) => arr(value)[i] ?? '');
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((v, i) => (
            <input key={i} className={INPUT} aria-label={`${i + 1}번째`} placeholder={`${i + 1}`} value={v} disabled={disabled}
              onChange={e => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
        </div>
      );
    }

    case 'pick': {
      if (!ctx.treatments.length) return <p className="text-sm text-amber-700">{needTreatments(ctx)}</p>;
      const extras = q.extras ?? [];
      const sel = arr(value);
      const full = !!q.max && sel.filter(x => !extras.includes(x)).length >= q.max;
      const pick = (o: string) => {
        if (extras.includes(o)) return onChange(sel.includes(o) ? [] : [o]); // 없음·모름은 혼자만 고른다
        onChange(toggle(sel.filter(x => !extras.includes(x)), o));
      };
      return (
        <div className="flex flex-wrap gap-2">
          {[...ctx.treatments, ...extras].map(o => (
            <button key={o} type="button" aria-pressed={sel.includes(o)} className={chip(sel.includes(o))}
              disabled={disabled || (full && !sel.includes(o) && !extras.includes(o))} onClick={() => pick(o)}>
              {o}
            </button>
          ))}
        </div>
      );
    }

    case 'rank': {
      if (!ctx.treatments.length) return <p className="text-sm text-amber-700">{needTreatments(ctx)}</p>;
      const v = isObj(value) ? value : {};
      const ranks = { r1: arr(v.r1), r2: arr(v.r2), r3: arr(v.r3) };
      const set = (patch: Record<string, unknown>) => onChange({ ...ranks, unknown: v.unknown === true, ...(q.feel ? { feel: v.feel === true } : {}), ...patch });
      // 한 진료는 한 순위에만. 같은 순위에 둘 이상 고르면 같은 순위다.
      const pick = (k: 'r1' | 'r2' | 'r3', t: string) => set({
        r1: ranks.r1.filter(x => x !== t), r2: ranks.r2.filter(x => x !== t), r3: ranks.r3.filter(x => x !== t),
        [k]: toggle(ranks[k], t), unknown: false,
      });
      return (
        <div className="space-y-2">
          {(['r1', 'r2', 'r3'] as const).map((k, i) => (
            <div key={k} className="flex flex-wrap items-center gap-2">
              <span className="w-12 shrink-0 text-sm font-medium text-gray-600">{i + 1}순위</span>
              {ctx.treatments.map(t => (
                <button key={t} type="button" aria-pressed={ranks[k].includes(t)} className={chip(ranks[k].includes(t))} disabled={disabled} onClick={() => pick(k, t)}>
                  {t}
                </button>
              ))}
            </div>
          ))}
          <p className="text-xs text-gray-500">순위가 같으면 한 칸에 둘 이상 고르세요.</p>
          <div className="flex flex-wrap gap-4">
            <Cell f={{ key: 'unknown', label: '모름', type: 'check' }} value={v.unknown} disabled={disabled}
              onChange={on => set(on ? { r1: [], r2: [], r3: [], unknown: true } : { unknown: false })} />
            {q.feel && <Cell f={{ key: 'feel', label: '체감으로 적음', type: 'check' }} value={v.feel} disabled={disabled} onChange={on => set({ feel: on })} />}
          </div>
        </div>
      );
    }

    case 'table': {
      const rows = Array.isArray(value) && value.length ? value.filter(isObj) : [{}];
      const fields = q.fields ?? [];
      return (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                {fields.map(f => (
                  <Cell key={f.key} f={f} value={row[f.key]} disabled={disabled}
                    onChange={x => onChange(rows.map((r, j) => (j === i ? { ...r, [f.key]: x } : r)))} />
                ))}
              </div>
              {!disabled && rows.length > 1 && (
                <button type="button" aria-label="줄 지우기" className="rounded p-1 text-gray-400 hover:bg-gray-200" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {!disabled && rows.length < (q.max ?? 10) && (
            <button type="button" className="flex items-center gap-1 text-sm text-blue-600" onClick={() => onChange([...rows, {}])}>
              <Plus size={14} /> 줄 추가
            </button>
          )}
        </div>
      );
    }

    case 'fields': {
      const v = isObj(value) ? value : {};
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.fields ?? []).map(f => (
            <div key={f.key} className={f.type === 'check' || f.type === 'long' ? 'sm:col-span-2' : ''}>
              <Cell f={f} value={v[f.key]} disabled={disabled} onChange={x => onChange({ ...v, [f.key]: x })} />
            </div>
          ))}
        </div>
      );
    }

    case 'upload':
      // https:// 주소만 연다(서버도 저장할 때 검사한다)
      return ctx.nasUrl?.startsWith('https://') ? (
        <a href={ctx.nasUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          자료 올리기 (새 창)
        </a>
      ) : null;

    default:
      return (
        <input className={INPUT} type={q.type === 'tel' ? 'tel' : q.type === 'email' ? 'email' : q.type === 'date' ? 'date' : 'text'}
          value={text(value)} disabled={disabled} onChange={e => onChange(e.target.value)} />
      );
  }
}
