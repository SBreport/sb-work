'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { assignmentWorkLabels, PACKAGE_WORK_LABELS, type BlogWorkLabel } from '@/lib/blog-assignment';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type MonthRoleData = {
  month: string;
  label: string;
  최적배포: number;
  인블: number;
  total: number;
} & Record<BlogWorkLabel, number>;

const trendRoles: BlogWorkLabel[] = ['사수', '부사수', ...PACKAGE_WORK_LABELS];
const trendColors = ['#3B82F6', '#10B981', '#2563EB', '#059669', '#7C3AED', '#0891B2'];

function getRecentMonths(currentMonth: string, count: number): string[] {
  const [y, m] = currentMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(y, m - 1 - i, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y.slice(2)}.${Number(m)}월`;
}

interface Props {
  currentMonth: string;
}

export default function MonthlyTrendChart({ currentMonth }: Props) {
  const [data, setData] = useState<MonthRoleData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    const months = getRecentMonths(currentMonth, 6);

    // 한 번의 쿼리로 6개월 데이터 모두 가져오기
    const { data: assignments } = await supabase
      .from('assignments')
      .select('month, package_name, main_quantity, sub_quantity, optimal_quantity, inbl_quantity')
      .in('month', months);

    // 월별 집계
    const monthMap = new Map<string, MonthRoleData>();
    for (const m of months) {
      monthMap.set(m, { month: m, label: monthLabel(m), 사수: 0, 부사수: 0,
        '네이버 블로그': 0, 'SEO 콘텐츠': 0, '블로그(임상/논문)': 0, '블로그(정보성)': 0,
        최적배포: 0, 인블: 0, total: 0 });
    }

    for (const a of assignments || []) {
      const entry = monthMap.get(a.month);
      if (!entry) continue;
      const [mainLabel, subLabel] = assignmentWorkLabels(a);
      entry[mainLabel] += a.main_quantity || 0;
      entry[subLabel] += a.sub_quantity || 0;
      entry.최적배포 += a.optimal_quantity || 0;
      entry.인블 += a.inbl_quantity || 0;
      entry.total += (a.main_quantity || 0) + (a.sub_quantity || 0) + (a.optimal_quantity || 0) + (a.inbl_quantity || 0);
    }

    setData(months.map(m => monthMap.get(m)!));
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  if (loading) {
    return <div className="py-6 text-center text-gray-400 text-xs">차트 로딩 중...</div>;
  }

  if (data.every(d => d.total === 0)) {
    return <div className="py-6 text-center text-gray-400 text-xs">데이터가 없습니다.</div>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: unknown, name: unknown) => [`${value}건`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {trendRoles.map((role, index) => data.some(d => d[role] > 0) && (
            <Bar key={role} dataKey={role} stackId="a" fill={trendColors[index]} />
          ))}
          <Bar dataKey="인블" stackId="a" fill="#F59E0B" />
          <Bar dataKey="최적배포" stackId="a" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
