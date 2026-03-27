'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MonthSelector from '@/components/MonthSelector';
import type { Assignment } from '@/types/database';
import NoticeBoard from '@/components/NoticeBoard';
import { Briefcase, ChevronUp, ChevronDown, LayoutList, LayoutGrid } from 'lucide-react';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function getAdjacentMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function shortMonthLabel(month: string): string {
  const [, m] = month.split('-');
  return `${Number(m)}월`;
}
function clean(val: string | null | undefined): string {
  return (val || '').replace(/,/g, '').trim();
}

interface MonthSummary { total: number; writing: number; review: number; sub: number; optimal: number; inbl: number; }

function calcSummary(assignments: Assignment[], userId: string): MonthSummary {
  let writing = 0, review = 0, sub = 0, optimal = 0, inbl = 0;
  for (const a of assignments) {
    if (a.main_writer_id === userId) {
      // 사수의 main_quantity는 항상 직접 '작성'
      writing += a.main_quantity;
      // 부사수가 따로 있으면, 부사수 작성분(sub_quantity)을 사수가 '검토'
      const hasSeparateSub = a.sub_writer_id && a.sub_writer_id !== userId;
      if (hasSeparateSub) review += a.sub_quantity;
    }
    if (a.sub_writer_id === userId) sub += a.sub_quantity;
    if (a.optimal_writer_id === userId) optimal += a.optimal_quantity;
    if (a.inbl_writer_id === userId) inbl += a.inbl_quantity;
  }
  return { total: writing + review + sub + optimal + inbl, writing, review, sub, optimal, inbl };
}

interface MyAssignment extends Assignment {
  roles: { label: string; qty: number }[];
  totalQty: number;
  partnerName: string | null;
  partnerRole: string | null; // '사수' or '부사수'
  isNew: boolean; // 전월에 없던 신규 지점
}

type SortKey = 'renewal_day' | 'category' | 'name' | 'role' | 'qty';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'card';

const ROLE_TAG: Record<string, string> = {
  '작성': 'bg-blue-100 text-blue-700',
  '검토': 'bg-indigo-100 text-indigo-700',
  '부사수': 'bg-green-100 text-green-700',
  '최적': 'bg-purple-100 text-purple-700',
  '인블': 'bg-amber-100 text-amber-700',
};
const ROLE_PILL: Record<string, string> = {
  '작성': 'bg-blue-50 text-blue-700 border-blue-200',
  '검토': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '부사수': 'bg-green-50 text-green-700 border-green-200',
  '최적배포': 'bg-purple-50 text-purple-700 border-purple-200',
  '인블': 'bg-amber-50 text-amber-700 border-amber-200',
};
const PARTNER_COLORS = [
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-400' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-400' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-400' },
];
const catColors: Record<string, string> = {
  '피부과': 'bg-pink-50 text-pink-700 border-pink-200',
  '치과': 'bg-sky-50 text-sky-700 border-sky-200',
  '성형외과': 'bg-purple-50 text-purple-700 border-purple-200',
  '한의원': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '산부인과': 'bg-rose-50 text-rose-700 border-rose-200',
  '내과': 'bg-teal-50 text-teal-700 border-teal-200',
  '안과': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  '세무법인': 'bg-slate-50 text-slate-700 border-slate-200',
};
const typeColors: Record<string, string> = {
  '유앤아이': 'bg-blue-50 text-blue-700 border-blue-200',
  '로컬': 'bg-orange-50 text-orange-700 border-orange-200',
  '솔루션': 'bg-violet-50 text-violet-700 border-violet-200',
};

interface MonthCard {
  month: string;
  total: number;
  writing: number;
  review: number;
  sub: number;
  optimal: number;
  inbl: number;
  branchCount: number;
  branchIds: Set<string>; // 담당 지점 ID 집합 (변경 감지용)
  hasChange?: boolean; // 전월 대비 지점 변경 여부
}

export default function FreelancerPage() {
  const { user, profile, viewAsWriterId, viewAsProfile, isViewingAs } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [monthCards, setMonthCards] = useState<MonthCard[]>([]);
  const [monthCardsLoading, setMonthCardsLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [prevSummary, setPrevSummary] = useState<MonthSummary | null>(null);
  const [nextSummary, setNextSummary] = useState<MonthSummary | null>(null);
  const [prevBranchIds, setPrevBranchIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('role');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // 모바일 감지 → 기본 카드뷰
  const [viewMode, setViewMode] = useState<ViewMode>(
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'card' : 'table'
  );

  const targetUserId = isViewingAs ? viewAsWriterId : user?.id;
  const displayName = isViewingAs ? viewAsProfile?.name : profile?.name;

  // 월별 카드 데이터 로드 (대시보드용)
  const fetchMonthCards = useCallback(async () => {
    if (!targetUserId) return;
    setMonthCardsLoading(true);

    // 내 배정 + 시스템에 존재하는 전체 월 목록을 동시에 가져오기
    const [myRes, allMonthsRes] = await Promise.all([
      supabase
        .from('assignments')
        .select('month, branch_id, main_writer_id, sub_writer_id, optimal_writer_id, inbl_writer_id, main_quantity, sub_quantity, optimal_quantity, inbl_quantity')
        .or(`main_writer_id.eq.${targetUserId},sub_writer_id.eq.${targetUserId},optimal_writer_id.eq.${targetUserId},inbl_writer_id.eq.${targetUserId}`),
      // 시스템에 존재하는 모든 월 (다른 작가 배정 포함)
      supabase.from('assignments').select('month'),
    ]);

    const allAssignments = myRes.data;
    if (!allAssignments) { setMonthCardsLoading(false); return; }

    // 시스템에 존재하는 전체 월 집합
    const systemMonths = new Set<string>();
    if (allMonthsRes.data) {
      for (const row of allMonthsRes.data) systemMonths.add(row.month);
    }

    // 월별 집계
    const monthMap = new Map<string, MonthCard>();
    const emptyCard = (month: string): MonthCard => ({ month, total: 0, writing: 0, review: 0, sub: 0, optimal: 0, inbl: 0, branchCount: 0, branchIds: new Set() });

    for (const a of allAssignments) {
      if (!monthMap.has(a.month)) monthMap.set(a.month, emptyCard(a.month));
      const card = monthMap.get(a.month)!;
      let counted = false;
      if (a.main_writer_id === targetUserId) {
        // 사수의 main_quantity는 항상 직접 '작성'
        card.writing += a.main_quantity;
        // 부사수가 따로 있으면, 부사수 작성분(sub_quantity)을 사수가 '검토'
        const hasSeparateSub = a.sub_writer_id && a.sub_writer_id !== targetUserId;
        if (hasSeparateSub) card.review += a.sub_quantity;
        counted = true;
      }
      if (a.sub_writer_id === targetUserId) { card.sub += a.sub_quantity; counted = true; }
      if (a.optimal_writer_id === targetUserId) { card.optimal += a.optimal_quantity; counted = true; }
      if (a.inbl_writer_id === targetUserId) { card.inbl += a.inbl_quantity; counted = true; }
      if (counted) { card.branchCount++; card.branchIds.add(a.branch_id); }
    }

    for (const card of monthMap.values()) {
      card.total = card.writing + card.review + card.sub + card.optimal + card.inbl;
    }

    // 가장 오래된 활동 월 ~ 시스템 최대 월 사이 빈 월도 0건 카드로 채움
    const currentMonth = getCurrentMonth();
    const allMonthKeys = [...Array.from(monthMap.keys()), ...Array.from(systemMonths), currentMonth];
    if (allMonthKeys.length > 0) {
      allMonthKeys.sort();
      // 내 활동이 있는 월만으로 earliest 결정 (시스템 월 전체를 earliest로 쓰면 불필요하게 과거가 길어짐)
      const myMonths = Array.from(monthMap.keys());
      if (myMonths.length === 0) { setMonthCardsLoading(false); return; }
      myMonths.sort();
      const earliest = myMonths[0];
      const latest = allMonthKeys[allMonthKeys.length - 1];

      const [ey, em] = earliest.split('-').map(Number);
      const [ly, lm] = latest.split('-').map(Number);
      let y = ey, m = em;
      while (y < ly || (y === ly && m <= lm)) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        if (!monthMap.has(key)) monthMap.set(key, emptyCard(key));
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    // 다음 달 카드에만 지점 변경/중단 표시 (이번달 → 다음달 비교)
    const nextMonth = getAdjacentMonth(currentMonth, 1);
    const curCard = monthMap.get(currentMonth);
    const nxtCard = monthMap.get(nextMonth);
    if (curCard && nxtCard) {
      if (curCard.branchIds.size > 0 && nxtCard.branchIds.size > 0) {
        const same = curCard.branchIds.size === nxtCard.branchIds.size &&
          [...nxtCard.branchIds].every(id => curCard.branchIds.has(id));
        if (!same) nxtCard.hasChange = true;
      } else if (curCard.branchIds.size > 0 && nxtCard.branchIds.size === 0) {
        nxtCard.hasChange = true;
      }
    }

    const cards = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));
    setMonthCards(cards);
    setMonthCardsLoading(false);
  }, [targetUserId]);

  useEffect(() => { fetchMonthCards(); }, [fetchMonthCards]);

  const handleSelectMonth = useCallback((m: string) => {
    setSelectedMonth(m);
    setMonth(m);
  }, []);

  const handleBackToDashboard = () => {
    setSelectedMonth(null);
  };

  const fetchMyAssignments = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    const prevMonth = getAdjacentMonth(month, -1);
    const nextMonth = getAdjacentMonth(month, 1);
    const selectQuery = `*, branch:branches(*),
      main_writer:profiles!assignments_main_writer_id_fkey(name),
      sub_writer:profiles!assignments_sub_writer_id_fkey(name)`;
    const [curRes, prevRes, nextRes] = await Promise.all([
      supabase.from('assignments').select(selectQuery).eq('month', month).order('renewal_day'),
      supabase.from('assignments').select('*').eq('month', prevMonth),
      supabase.from('assignments').select('*').eq('month', nextMonth),
    ]);
    setAssignments(curRes.data || []);
    setPrevSummary(prevRes.data ? calcSummary(prevRes.data, targetUserId) : null);
    setNextSummary(nextRes.data ? calcSummary(nextRes.data, targetUserId) : null);
    // 전월에 내가 담당했던 지점 ID 수집 (신규 지점 표시용)
    if (prevRes.data) {
      const ids = new Set<string>();
      for (const a of prevRes.data) {
        if (a.main_writer_id === targetUserId || a.sub_writer_id === targetUserId ||
            a.optimal_writer_id === targetUserId || a.inbl_writer_id === targetUserId) {
          ids.add(a.branch_id);
        }
      }
      setPrevBranchIds(ids);
    } else {
      setPrevBranchIds(new Set());
    }
    setLoading(false);
  }, [targetUserId, month]);

  useEffect(() => { fetchMyAssignments(); }, [fetchMyAssignments]);

  const uid = targetUserId || '';
  const curSummary = calcSummary(assignments, uid);

  const myAssignments: MyAssignment[] = useMemo(() => {
    return assignments
      .filter(a => a.main_writer_id === uid || a.sub_writer_id === uid || a.optimal_writer_id === uid || a.inbl_writer_id === uid)
      .map(a => {
        const roles: { label: string; qty: number }[] = [];
        let partnerName: string | null = null;
        let partnerRole: string | null = null;

        if (a.main_writer_id === uid) {
          // 사수의 main_quantity는 항상 직접 '작성'
          roles.push({ label: '작성', qty: a.main_quantity });
          // 부사수가 따로 있으면, 부사수 작성분을 사수가 '검토'
          const hasSeparateSub = a.sub_writer_id && a.sub_writer_id !== uid;
          if (hasSeparateSub) {
            roles.push({ label: '검토', qty: a.sub_quantity });
          }
          const subName = (a.sub_writer as { name: string } | undefined)?.name || a.sub_writer_name || null;
          if (subName && a.sub_writer_id !== uid) { partnerName = subName; partnerRole = '부사수'; }
        }
        if (a.sub_writer_id === uid) {
          roles.push({ label: '부사수', qty: a.sub_quantity });
          const mainName = (a.main_writer as { name: string } | undefined)?.name || a.main_writer_name || null;
          if (mainName && a.main_writer_id !== uid) { partnerName = mainName; partnerRole = '사수'; }
        }
        if (a.optimal_writer_id === uid) roles.push({ label: '최적', qty: a.optimal_quantity });
        if (a.inbl_writer_id === uid) roles.push({ label: '인블', qty: a.inbl_quantity });

        const totalQty = roles.reduce((s, r) => s + r.qty, 0);
        // 전월에 내가 담당하지 않았던 지점이면 '신규'
        const isNew = prevBranchIds.size > 0 && !prevBranchIds.has(a.branch_id);
        return { ...a, roles, totalQty, partnerName, partnerRole, isNew };
      });
  }, [assignments, uid, prevBranchIds]);

  const sortedAssignments = useMemo(() => {
    const sorted = [...myAssignments];
    sorted.sort((a, b) => {
      // 사용자가 헤더 클릭으로 정렬 변경한 경우
      if (sortKey !== 'role') {
        let cmp = 0;
        switch (sortKey) {
          case 'renewal_day': cmp = a.renewal_day - b.renewal_day; break;
          case 'category': cmp = clean(a.branch?.category).localeCompare(clean(b.branch?.category)); break;
          case 'name': cmp = (a.branch?.name || '').localeCompare(b.branch?.name || ''); break;
          case 'qty': cmp = a.totalQty - b.totalQty; break;
        }
        if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      }

      // 기본 정렬: 함께하는 담당자 → 과목 → 지점명
      const aPartner = a.partnerName || 'zzz'; // 파트너 없으면 맨 뒤
      const bPartner = b.partnerName || 'zzz';
      const partnerCmp = aPartner.localeCompare(bPartner);
      if (partnerCmp !== 0) return partnerCmp;

      const catCmp = clean(a.branch?.category).localeCompare(clean(b.branch?.category));
      if (catCmp !== 0) return catCmp;

      return (a.branch?.name || '').localeCompare(b.branch?.name || '');
    });
    return sorted;
  }, [myAssignments, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortHeader = ({ label, sortKeyName, className }: { label: string; sortKeyName: SortKey; className?: string }) => (
    <th onClick={() => handleSort(sortKeyName)}
      className={`px-3 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none text-xs whitespace-nowrap ${className || ''}`}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortKey === sortKeyName && (sortDir === 'asc' ? <ChevronUp size={11} className="text-blue-600" /> : <ChevronDown size={11} className="text-blue-600" />)}
      </span>
    </th>
  );

  // 집계
  const { byCategory, byType } = useMemo(() => {
    const byCategory: Record<string, { count: number; qty: number }> = {};
    const byType: Record<string, { count: number; qty: number }> = {};
    for (const a of myAssignments) {
      const cat = clean(a.branch?.category) || '기타';
      const ptype = clean(a.branch?.product_type) || '기타';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, qty: 0 };
      byCategory[cat].count++; byCategory[cat].qty += a.totalQty;
      if (!byType[ptype]) byType[ptype] = { count: 0, qty: 0 };
      byType[ptype].count++; byType[ptype].qty += a.totalQty;
    }
    return { byCategory, byType };
  }, [myAssignments]);

  const partnerSummary = useMemo(() => {
    const partners: Record<string, { name: string; role: string; count: number; qty: number }> = {};
    let bothCount = 0;
    for (const a of myAssignments) {
      if (a.main_writer_id === uid && a.sub_writer_id === uid) { bothCount++; continue; }
      if (a.partnerName && a.partnerRole) {
        const key = `${a.partnerName}-${a.partnerRole}`;
        if (!partners[key]) partners[key] = { name: a.partnerName, role: a.partnerRole, count: 0, qty: 0 };
        partners[key].count++;
        partners[key].qty += a.totalQty;
      }
    }
    return { partners: Object.values(partners).sort((a, b) => b.count - a.count), bothCount };
  }, [myAssignments, uid]);

  const hasMultipleCategories = Object.keys(byCategory).length > 1;
  const hasMultipleTypes = Object.keys(byType).length > 1;
  const hasPartners = partnerSummary.partners.length > 0 || partnerSummary.bothCount > 0;

  const activeRoles = [
    curSummary.writing > 0 ? { label: '작성', qty: curSummary.writing } : null,
    curSummary.review > 0 ? { label: '검토', qty: curSummary.review } : null,
    curSummary.sub > 0 ? { label: '부사수', qty: curSummary.sub } : null,
    curSummary.optimal > 0 ? { label: '최적배포', qty: curSummary.optimal } : null,
    curSummary.inbl > 0 ? { label: '인블', qty: curSummary.inbl } : null,
  ].filter(Boolean) as { label: string; qty: number }[];

  // 파트너별 색상 매핑 (이름 가나다순으로 팔레트 순환 배정)
  const partnerColorMap = useMemo(() => {
    const names = [...new Set(myAssignments.map(a => a.partnerName).filter(Boolean))].sort();
    const map: Record<string, typeof PARTNER_COLORS[0]> = {};
    names.forEach((name, i) => { map[name!] = PARTNER_COLORS[i % PARTNER_COLORS.length]; });
    return map;
  }, [myAssignments]);

  // 파트너 표시 (색상 구분 적용)
  const renderPartner = (a: MyAssignment) => {
    if (!a.partnerName || !a.partnerRole) return <span className="text-gray-300">-</span>;
    const color = partnerColorMap[a.partnerName];
    if (!color) {
      return (
        <span className="text-xs">
          <span className="text-gray-400">{a.partnerRole}</span>{' '}
          <span className="font-medium text-gray-700">{a.partnerName}</span>
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${color.bg} ${color.text} ${color.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
        {a.partnerName}
      </span>
    );
  };

  // === 미확인 월 추적 (localStorage) ===
  const getViewedMonths = useCallback((): Set<string> => {
    if (!targetUserId) return new Set();
    try {
      const raw = localStorage.getItem(`viewed_months_${targetUserId}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }, [targetUserId]);

  const markMonthViewed = useCallback((m: string) => {
    if (!targetUserId) return;
    const viewed = getViewedMonths();
    viewed.add(m);
    localStorage.setItem(`viewed_months_${targetUserId}`, JSON.stringify([...viewed]));
  }, [targetUserId, getViewedMonths]);

  const handleSelectMonthWithMark = useCallback((m: string) => {
    // 관리자 미리보기 모드에서는 viewed 마킹 안 함
    if (!isViewingAs) {
      markMonthViewed(m);
    }
    handleSelectMonth(m);
  }, [markMonthViewed, handleSelectMonth, isViewingAs]);

  // === 월 선택 대시보드 ===
  if (!selectedMonth) {
    const currentMonth = getCurrentMonth();
    const viewedMonths = getViewedMonths();
    // 내림차순 정렬 (최신 → 과거)
    const sortedCards = [...monthCards].sort((a, b) => b.month.localeCompare(a.month));

    return (
      <div className="p-3 sm:p-4 max-w-[960px]">
        <div className="mb-4">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">
            {displayName || '담당자'}님, 안녕하세요
          </h2>
          <p className="text-xs text-gray-500 mt-1">확인할 월을 선택해주세요.</p>
        </div>

        {/* 공지사항 */}
        <NoticeBoard month={currentMonth} />

        {monthCardsLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : sortedCards.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
            <Briefcase size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">배정된 업무가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sortedCards.map(card => {
              const [y, m] = card.month.split('-');
              const isCurrent = card.month === currentMonth;
              const isUnseen = !viewedMonths.has(card.month) && card.month >= currentMonth;
              const roles = [
                card.writing > 0 ? { label: '작성', qty: card.writing, color: 'text-blue-600' } : null,
                card.review > 0 ? { label: '검토', qty: card.review, color: 'text-indigo-600' } : null,
                card.sub > 0 ? { label: '부사수', qty: card.sub, color: 'text-green-600' } : null,
                card.optimal > 0 ? { label: '최적', qty: card.optimal, color: 'text-purple-600' } : null,
                card.inbl > 0 ? { label: '인블', qty: card.inbl, color: 'text-amber-600' } : null,
              ].filter(Boolean) as { label: string; qty: number; color: string }[];

              const isEmpty = card.total === 0;
              const hasWritingAndReview = card.writing > 0 && card.review > 0;
              // 작성/검토 외 나머지 역할
              const otherRoles = roles.filter(r => r.label !== '작성' && r.label !== '검토');

              return (
                <button
                  key={card.month}
                  onClick={() => handleSelectMonthWithMark(card.month)}
                  className={`relative text-left rounded-xl border-2 p-4 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                    isCurrent
                      ? 'border-blue-400 bg-blue-50 shadow-sm'
                      : isEmpty
                        ? 'border-gray-100 bg-gray-50 hover:border-gray-300'
                        : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  {/* 미확인 파란 점 */}
                  {isUnseen && !isEmpty && (
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                  )}
                  <div className="flex items-baseline justify-between mb-2">
                    <span className={`text-lg font-bold ${isCurrent ? 'text-blue-700' : isEmpty ? 'text-gray-400' : 'text-gray-900'}`}>
                      {Number(m)}월
                    </span>
                    <span className="text-[10px] text-gray-400">{y}</span>
                  </div>

                  {hasWritingAndReview ? (
                    <>
                      {/* 사수: 작성/검토 분리 강조 표시 */}
                      <div className="flex items-end gap-3 mb-1.5">
                        <div>
                          <span className="text-[10px] text-blue-500 font-medium">작성</span>
                          <p className="text-xl font-bold text-blue-600 leading-tight">
                            {card.writing}<span className="text-[10px] font-normal text-gray-400 ml-0.5">건</span>
                          </p>
                        </div>
                        <div className="text-gray-300 text-sm pb-0.5">+</div>
                        <div>
                          <span className="text-[10px] text-indigo-500 font-medium">검토</span>
                          <p className="text-xl font-bold text-indigo-600 leading-tight">
                            {card.review}<span className="text-[10px] font-normal text-gray-400 ml-0.5">건</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-1">
                        {`${card.branchCount}개 지점 · 총 ${card.total}건`}
                        {card.hasChange && (
                          <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 border border-orange-200 rounded font-semibold">변경</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      {/* 부사수/단일 역할: 기존 총합 표시 */}
                      <p className={`text-2xl font-bold mb-1 ${isCurrent ? 'text-blue-600' : isEmpty ? 'text-gray-300' : 'text-gray-800'}`}>
                        {card.total}<span className="text-xs font-normal text-gray-400 ml-0.5">건</span>
                      </p>
                      <p className="text-[10px] text-gray-400 mb-2">
                        {isEmpty ? '배정 없음' : `${card.branchCount}개 지점`}
                        {card.hasChange && !isEmpty && (
                          <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 border border-orange-200 rounded font-semibold">변경</span>
                        )}
                        {card.hasChange && isEmpty && (
                          <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-500 border border-red-200 rounded font-semibold">중단</span>
                        )}
                      </p>
                    </>
                  )}

                  {/* 기타 역할 (부사수, 최적, 인블 등) */}
                  {otherRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {otherRoles.map(r => (
                        <span key={r.label} className={`text-[10px] ${r.color}`}>
                          {r.label} {r.qty}
                        </span>
                      ))}
                    </div>
                  )}
                  {isCurrent && (
                    <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-blue-200 text-blue-700 rounded-full font-semibold">
                      이번달
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // === 상세 뷰 ===
  return (
    <div className="p-3 sm:p-4 max-w-[960px]">
      {/* 헤더 - 뒤로가기 추가 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToDashboard}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="월 선택으로 돌아가기"
          >
            <ChevronUp size={18} className="rotate-[-90deg]" />
          </button>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">
            {displayName || '담당자'}님의 업무
          </h2>
        </div>
        <MonthSelector month={month} onChange={(m) => { setMonth(m); setSelectedMonth(m); }} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* === 요약 카드 (통합) === */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3">
            <div className="px-4 py-3">
              {/* 상단: 총건수 + 역할 */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{curSummary.total}</span>
                  <span className="text-sm text-gray-400">건</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {activeRoles.map(r => (
                    <span key={r.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ROLE_PILL[r.label] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {r.label} <span className="font-bold">{r.qty}</span>
                    </span>
                  ))}
                </div>
              </div>
              {/* 전후월 */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{shortMonthLabel(getAdjacentMonth(month, -1))} {prevSummary?.total || 0}건</span>
                <span className="text-gray-200">|</span>
                <span>{shortMonthLabel(getAdjacentMonth(month, 1))} {nextSummary?.total || 0}건</span>
              </div>
            </div>

            {/* 태그 라인 */}
            {(hasMultipleCategories || hasMultipleTypes || hasPartners) && (
              <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                {hasMultipleCategories && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">업종</span>
                    {Object.entries(byCategory).sort((a, b) => b[1].qty - a[1].qty).map(([cat, d]) => (
                      <span key={cat} className={`px-1.5 py-0.5 rounded border font-medium ${catColors[cat] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {cat} {d.qty}건
                      </span>
                    ))}
                  </div>
                )}
                {hasMultipleTypes && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">유형</span>
                    {Object.entries(byType).sort((a, b) => b[1].qty - a[1].qty).map(([t, d]) => (
                      <span key={t} className={`px-1.5 py-0.5 rounded border font-medium ${typeColors[t] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {t} {d.qty}건
                      </span>
                    ))}
                  </div>
                )}
                {hasPartners && (() => {
                  const mainPartners = partnerSummary.partners.filter(p => p.role === '사수');
                  const subPartners = partnerSummary.partners.filter(p => p.role === '부사수');
                  return (
                    <div className="flex flex-col gap-1 w-full">
                      {mainPartners.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-blue-600 font-semibold shrink-0">담당 사수</span>
                          {mainPartners.map(p => {
                            const color = partnerColorMap[p.name];
                            return (
                              <span key={p.name} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-medium ${color ? `${color.bg} ${color.text} ${color.border}` : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                {color && <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />}
                                {p.name} <span className={color ? 'opacity-60' : 'text-blue-400'}>{p.count}곳(원고 {p.qty}건)</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {subPartners.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-green-600 font-semibold shrink-0">담당 부사수</span>
                          {subPartners.map(p => {
                            const color = partnerColorMap[p.name];
                            return (
                              <span key={p.name} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-medium ${color ? `${color.bg} ${color.text} ${color.border}` : 'bg-green-50 text-green-700 border-green-200'}`}>
                                {color && <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />}
                                {p.name} <span className={color ? 'opacity-60' : 'text-green-400'}>{p.count}곳(원고 {p.qty}건)</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {partnerSummary.bothCount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-600 font-semibold shrink-0">사수+부사수 겸임</span>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">{partnerSummary.bothCount}곳</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* === 배정 목록 === */}
          {sortedAssignments.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* 헤더 + 뷰 전환 */}
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{myAssignments.length}개 지점</span>
                <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1 rounded ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title="테이블 뷰"
                  >
                    <LayoutList size={15} />
                  </button>
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-1 rounded ${viewMode === 'card' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title="카드 뷰"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>
              </div>

              {/* 테이블 뷰 */}
              {viewMode === 'table' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <SortHeader label="갱신일" sortKeyName="renewal_day" className="text-left pl-4 w-14" />
                      <SortHeader label="과목" sortKeyName="category" className="text-left w-14" />
                      <SortHeader label="지점명" sortKeyName="name" className="text-left" />
                      <SortHeader label="역할" sortKeyName="role" className="text-center w-24" />
                      <th className="px-2 py-2 font-medium text-gray-500 text-xs whitespace-nowrap text-center">포스팅</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs whitespace-nowrap">함께하는 담당자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssignments.map((a, idx) => (
                      <tr key={a.id} className={`border-b border-gray-50 hover:bg-blue-50/20 ${a.isNew ? 'bg-orange-50/60' : idx % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                        <td className="pl-4 pr-2 py-1.5 text-gray-500 text-xs whitespace-nowrap">{a.renewal_day}일</td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] whitespace-nowrap ${catColors[clean(a.branch?.category)] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {clean(a.branch?.category) || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                          {a.branch?.name || '-'}
                          {a.isNew && <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 border border-orange-200 rounded text-[10px] font-semibold">신규</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="inline-flex gap-0.5">
                            {a.roles.map(r => (
                              <span key={r.label} className={`px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${ROLE_TAG[r.label] || 'bg-gray-100 text-gray-600'}`}>
                                {r.label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          {a.roles.length > 1 ? (
                            <div className="inline-flex items-center gap-0.5 text-[11px]">
                              {a.roles.map((r, i) => (
                                <span key={r.label}>
                                  {i > 0 && <span className="text-gray-300 mx-0.5">/</span>}
                                  <span className={`font-bold ${r.label === '작성' ? 'text-blue-600' : r.label === '검토' ? 'text-indigo-600' : r.label === '부사수' ? 'text-green-600' : 'text-gray-700'}`}>
                                    {r.qty}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : a.totalQty > 0 ? (
                            <span className="font-bold text-gray-900">{a.totalQty}</span>
                          ) : (
                            <span className="text-red-500 text-xs font-semibold">확인</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">{renderPartner(a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* 카드 뷰 */}
              {viewMode === 'card' && (
                <div className="grid grid-cols-1 gap-2 p-2 sm:p-3 sm:grid-cols-2">
                  {sortedAssignments.map(a => (
                    <div key={a.id} className={`border rounded-lg p-3 transition-colors ${a.isNew ? 'border-orange-200 bg-orange-50/50 hover:border-orange-300' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/10'}`}>
                      {/* 상단: 지점명 + 포스팅 수 */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {a.branch?.name || '-'}
                            {a.isNew && <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 border border-orange-200 rounded text-[10px] font-semibold align-middle">신규</span>}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.5 rounded border text-[11px] ${catColors[clean(a.branch?.category)] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {clean(a.branch?.category)}
                            </span>
                            <span className="text-xs text-gray-400">{a.renewal_day}일 갱신</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {a.roles.length > 1 ? (
                            <div className="flex flex-col items-end gap-0">
                              {a.roles.map(r => (
                                <p key={r.label} className={`text-xs font-bold leading-tight ${r.label === '작성' ? 'text-blue-600' : r.label === '검토' ? 'text-indigo-600' : r.label === '부사수' ? 'text-green-600' : 'text-gray-700'}`}>
                                  {r.label} {r.qty}<span className="font-normal text-gray-400">건</span>
                                </p>
                              ))}
                            </div>
                          ) : a.totalQty > 0 ? (
                            <p className="text-lg font-bold text-gray-900">{a.totalQty}<span className="text-xs font-normal text-gray-400 ml-0.5">건</span></p>
                          ) : (
                            <p className="text-xs font-semibold text-red-500">확인 필요</p>
                          )}
                        </div>
                      </div>
                      {/* 하단: 역할 + 담당자 */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {a.roles.map(r => (
                            <span key={r.label} className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_TAG[r.label] || 'bg-gray-100 text-gray-600'}`}>
                              {r.label} {r.qty}건
                            </span>
                          ))}
                        </div>
                        {a.partnerName && a.partnerRole && renderPartner(a)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
              <Briefcase size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">이번 달 배정된 업무가 없습니다.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
