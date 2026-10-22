import type { Assignment } from '../types/database';

export type BlogAssignment = Partial<Assignment>;
export interface WorkRole { label: string; qty: number }

export const PACKAGE_WORK_LABELS = ['네이버 블로그', 'SEO 콘텐츠', '블로그(임상/논문)', '블로그(정보성)'] as const;
export type BlogWorkLabel = typeof PACKAGE_WORK_LABELS[number] | '사수' | '부사수';

export function usesPackageWorkTypes(a: Pick<BlogAssignment, 'month'>): boolean {
  return (a.month || '') >= '2026-11';
}

export function isBranding(a: Pick<BlogAssignment, 'month' | 'package_name'>): boolean {
  return usesPackageWorkTypes(a) && a.package_name?.trim() === '브랜딩';
}

export function assignmentWorkLabels(a: Pick<BlogAssignment, 'month' | 'package_name'>): [BlogWorkLabel, BlogWorkLabel] {
  if (!usesPackageWorkTypes(a)) return ['사수', '부사수'];
  return isBranding(a) ? ['네이버 블로그', 'SEO 콘텐츠'] : ['블로그(임상/논문)', '블로그(정보성)'];
}

export function blogQuantityFor(a: BlogAssignment, writerId: string): number {
  if (!isBranding(a)) return (a.main_writer_id === writerId ? a.main_quantity || 0 : 0)
    + (usesPackageWorkTypes(a) && a.sub_writer_id === writerId ? a.sub_quantity || 0 : 0);
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
      if (a.main_writer_id === writerId) roles.push({ label: '네이버 블로그', qty: a.main_quantity || 0 });
    } else {
      if (a.main_writer_id === writerId && (a.information_quantity || 0) > 0) roles.push({ label: '정보형', qty: a.information_quantity! });
      if (a.clinical_writer_id === writerId && (a.clinical_quantity || 0) > 0) roles.push({ label: '임상/논문형', qty: a.clinical_quantity! });
    }
    if (a.sub_writer_id === writerId) roles.push({ label: 'SEO 콘텐츠', qty: a.sub_quantity || 0 });
  } else if (usesPackageWorkTypes(a)) {
    const [mainLabel, subLabel] = assignmentWorkLabels(a);
    if (a.main_writer_id === writerId) roles.push({ label: mainLabel, qty: a.main_quantity || 0 });
    if (a.sub_writer_id === writerId) roles.push({ label: subLabel, qty: a.sub_quantity || 0 });
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
    '정보형': 'information', '임상/논문형': 'clinical', '네이버 블로그': 'unspecified', 'SEO 콘텐츠': 'seo',
    '블로그(임상/논문)': 'clinical', '블로그(정보성)': 'information',
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
