'use client';

import { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc' | null;

export interface SortState<K extends string = string> {
  key: K | null;
  dir: SortDir;
}

/**
 * 헤더 클릭으로 정렬 토글하는 훅
 * 클릭 사이클: null → asc → desc → null
 */
export function useSort<K extends string = string>(initial: SortState<K> = { key: null, dir: null }) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const onSort = useCallback((key: K) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key: null, dir: null };
      return { key, dir: 'asc' };
    });
  }, []);

  return { sort, onSort, setSort };
}

/**
 * 배열을 sort 상태에 따라 정렬하여 반환
 * getValue: 각 행에서 정렬용 값을 추출하는 함수
 */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  getValue: (row: T, key: K) => string | number | null | undefined
): T[] {
  if (!sort.key || !sort.dir) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = getValue(a, sort.key as K);
    const vb = getValue(b, sort.key as K);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;   // null은 항상 마지막
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), 'ko') * dir;
  });
}

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * 정렬 가능한 테이블 헤더 셀
 * 사용:
 *   <SortableHeader label="이름" sortKey="name" sort={sort} onSort={onSort} />
 */
export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
  align = 'left',
}: SortableHeaderProps<K>) {
  const isActive = sort.key === sortKey;
  const dir = isActive ? sort.dir : null;
  const alignClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <th className={`px-3 py-2.5 text-${align} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 ${alignClass} font-medium text-xs hover:text-blue-600 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-600'}`}
      >
        {label}
        {dir === 'asc' ? <ChevronUp size={12} /> : dir === 'desc' ? <ChevronDown size={12} /> : <ChevronsUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
}
