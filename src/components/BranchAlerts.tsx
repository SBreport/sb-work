'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PlusCircle, MinusCircle } from 'lucide-react';

function getAdjacentMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

interface BranchChange {
  name: string;
  category: string;
  product_type: string;
}

interface Props {
  currentMonth: string;
}

export default function BranchAlerts({ currentMonth }: Props) {
  const [newBranches, setNewBranches] = useState<BranchChange[]>([]);
  const [removedBranches, setRemovedBranches] = useState<BranchChange[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    const prevMonth = getAdjacentMonth(currentMonth, -1);

    const [curRes, prevRes] = await Promise.all([
      supabase.from('assignments').select('branch:branches(name, category, product_type)').eq('month', currentMonth),
      supabase.from('assignments').select('branch:branches(name, category, product_type)').eq('month', prevMonth),
    ]);

    const curBranches = new Map<string, BranchChange>();
    const prevBranches = new Map<string, BranchChange>();

    for (const a of curRes.data || []) {
      const b = a.branch as unknown as { name: string; category: string; product_type: string } | null;
      if (b?.name) curBranches.set(b.name, { name: b.name, category: (b.category || '').replace(/,/g, ''), product_type: (b.product_type || '').replace(/,/g, '') });
    }
    for (const a of prevRes.data || []) {
      const b = a.branch as unknown as { name: string; category: string; product_type: string } | null;
      if (b?.name) prevBranches.set(b.name, { name: b.name, category: (b.category || '').replace(/,/g, ''), product_type: (b.product_type || '').replace(/,/g, '') });
    }

    const added: BranchChange[] = [];
    const removed: BranchChange[] = [];

    for (const [name, data] of curBranches) {
      if (!prevBranches.has(name)) added.push(data);
    }
    for (const [name, data] of prevBranches) {
      if (!curBranches.has(name)) removed.push(data);
    }

    setNewBranches(added);
    // 현재 월 데이터가 0건이면 "아직 배정 전"이므로 제외 목록을 표시하지 않음
    setRemovedBranches(curBranches.size > 0 ? removed : []);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { fetchChanges(); }, [fetchChanges]);

  if (loading) return null;
  if (newBranches.length === 0 && removedBranches.length === 0) return null;

  return (
    <div className="space-y-2">
      {newBranches.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 flex items-start gap-2">
          <PlusCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-green-800">신규 지점 {newBranches.length}곳 (전월 대비)</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {newBranches.map(b => (
                <span key={b.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  {b.name}
                  {b.product_type && <span className="opacity-60">{b.product_type}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {removedBranches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-start gap-2">
          <MinusCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-800">제외된 지점 {removedBranches.length}곳 (전월 대비)</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {removedBranches.map(b => (
                <span key={b.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                  {b.name}
                  {b.product_type && <span className="opacity-60">{b.product_type}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
