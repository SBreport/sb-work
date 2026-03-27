/* ── 담당자별 수량 집계 유틸리티 ── */

import type { Assignment } from '@/types/database';

export interface WriterStats {
  name: string;
  mainQty: number;
  subQty: number;
  optimalQty: number;
  inblQty: number;
  branchCount: number;
  prevTotal: number;
}

export function totalQty(s: { mainQty: number; subQty: number; optimalQty: number; inblQty: number }) {
  return s.mainQty + s.subQty + s.optimalQty + s.inblQty;
}

export function calcWriterStats(assignments: Partial<Assignment>[]): Record<string, WriterStats> {
  return assignments.reduce<Record<string, WriterStats>>((acc, a) => {
    const addWriter = (
      id: string | null | undefined,
      nameObj: unknown,
      nameFallback: string | null | undefined,
      role: 'main' | 'sub' | 'optimal' | 'inbl',
      qty: number
    ) => {
      const name = (nameObj as { name: string } | undefined)?.name || nameFallback;
      if (!name) return;
      const key = id || `name:${name}`;
      if (!acc[key]) acc[key] = { name, mainQty: 0, subQty: 0, optimalQty: 0, inblQty: 0, branchCount: 0, prevTotal: 0 };
      if (role === 'main') { acc[key].mainQty += qty; acc[key].branchCount++; }
      if (role === 'sub') acc[key].subQty += qty;
      if (role === 'optimal') acc[key].optimalQty += qty;
      if (role === 'inbl') acc[key].inblQty += qty;
    };
    addWriter(a.main_writer_id, a.main_writer, a.main_writer_name, 'main', a.main_quantity || 0);
    addWriter(a.sub_writer_id, a.sub_writer, a.sub_writer_name, 'sub', a.sub_quantity || 0);
    addWriter(a.optimal_writer_id, a.optimal_writer, a.optimal_writer_name, 'optimal', a.optimal_quantity || 0);
    addWriter(a.inbl_writer_id, a.inbl_writer, a.inbl_writer_name, 'inbl', a.inbl_quantity || 0);
    return acc;
  }, {});
}
