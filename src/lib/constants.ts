/* ── 공용 상수 ── */

// 배정 상태
export const ASSIGNMENT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '활성', color: 'text-gray-700', bg: 'bg-gray-100' },
  new: { label: '신규', color: 'text-green-700', bg: 'bg-green-100' },
  changed: { label: '변경', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  terminated: { label: '해지', color: 'text-red-700', bg: 'bg-red-100' },
  ai: { label: 'AI', color: 'text-purple-700', bg: 'bg-purple-100' },
  both: { label: '동시', color: 'text-blue-700', bg: 'bg-blue-100' },
};

export const STATUS_OPTIONS = Object.entries(ASSIGNMENT_STATUS_MAP).map(
  ([value, { label }]) => ({ value, label })
);

// 배정 select 쿼리 (Supabase join)
export const ASSIGNMENT_SELECT = `
  *, branch:branches(*),
  main_writer:profiles!assignments_main_writer_id_fkey(id, name),
  sub_writer:profiles!assignments_sub_writer_id_fkey(id, name),
  optimal_writer:profiles!assignments_optimal_writer_id_fkey(id, name),
  inbl_writer:profiles!assignments_inbl_writer_id_fkey(id, name)
`.trim();
