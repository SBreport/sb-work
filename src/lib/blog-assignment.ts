import type { Assignment } from '../types/database';

export type BlogAssignment = Partial<Assignment>;
export interface WorkRole { label: string; qty: number }

export function isBranding(a: BlogAssignment): boolean {
  return (a.month || '') >= '2026-11' && a.package_name === '브랜딩';
}

export function blogQuantityFor(a: BlogAssignment, writerId: string): number {
  if (!isBranding(a)) return a.main_writer_id === writerId ? a.main_quantity || 0 : 0;
  if (a.information_quantity == null && a.clinical_quantity == null) {
    return a.main_writer_id === writerId ? a.main_quantity || 0 : 0;
  }
  return (a.main_writer_id === writerId ? a.information_quantity || 0 : 0)
    + (a.clinical_writer_id === writerId ? a.clinical_quantity || 0 : 0);
}

export function workRolesFor(a: BlogAssignment, writerId: string): WorkRole[] {
  const roles: WorkRole[] = [];
  if (isBranding(a)) {
    if (a.information_quantity == null && a.clinical_quantity == null) {
      if (a.main_writer_id === writerId) roles.push({ label: '블로그 · 유형 미구분', qty: a.main_quantity || 0 });
    } else {
      if (a.main_writer_id === writerId && (a.information_quantity || 0) > 0) roles.push({ label: '정보형', qty: a.information_quantity! });
      if (a.clinical_writer_id === writerId && (a.clinical_quantity || 0) > 0) roles.push({ label: '임상/논문형', qty: a.clinical_quantity! });
    }
    if (a.sub_writer_id === writerId) roles.push({ label: 'SEO 콘텐츠', qty: a.sub_quantity || 0 });
  } else {
    if (a.main_writer_id === writerId) {
      roles.push({ label: '작성', qty: a.main_quantity || 0 });
      if (a.sub_writer_id && a.sub_writer_id !== writerId && (a.sub_quantity || 0) > 0) roles.push({ label: '검토', qty: a.sub_quantity! });
      else if (a.sub_writer_id === writerId && (a.sub_quantity || 0) > 0) roles.push({ label: '부사수', qty: a.sub_quantity! });
    } else if (a.sub_writer_id === writerId) roles.push({ label: '부사수', qty: a.sub_quantity || 0 });
  }
  if (a.optimal_writer_id === writerId) roles.push({ label: '최적', qty: a.optimal_quantity || 0 });
  if (a.inbl_writer_id === writerId) roles.push({ label: '인블', qty: a.inbl_quantity || 0 });
  return roles;
}

export function assignmentWriterFilter(writerId: string): string {
  return ['main', 'sub', 'optimal', 'inbl', 'clinical'].map(role => `${role}_writer_id.eq.${writerId}`).join(',');
}

export function summarizeWork(assignments: BlogAssignment[], writerId: string) {
  const summary = { total: 0, writing: 0, review: 0, sub: 0, optimal: 0, inbl: 0,
    information: 0, clinical: 0, unspecified: 0, seo: 0, blogTotal: 0 };
  const keys: Record<string, keyof typeof summary> = {
    '작성': 'writing', '검토': 'review', '부사수': 'sub', '최적': 'optimal', '인블': 'inbl',
    '정보형': 'information', '임상/논문형': 'clinical', '블로그 · 유형 미구분': 'unspecified', 'SEO 콘텐츠': 'seo',
  };
  for (const a of assignments) {
    for (const role of workRolesFor(a, writerId)) {
      summary[keys[role.label]] += role.qty;
      summary.total += role.qty;
    }
  }
  summary.blogTotal = summary.writing + summary.information + summary.clinical + summary.unspecified;
  return summary;
}
