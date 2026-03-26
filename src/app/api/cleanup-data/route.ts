import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/lib/auth-guard';

function stripCommas(val: string | null): string {
  if (!val) return '';
  return val.replace(/,/g, '').trim();
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  let cleaned = 0;

  // branches 테이블 정리
  const { data: branches } = await supabase.from('branches').select('id, category, product_type, name');
  if (branches) {
    for (const b of branches) {
      const updates: Record<string, string> = {};
      const newCat = stripCommas(b.category);
      const newType = stripCommas(b.product_type);
      const newName = b.name?.replace(/,/g, '').trim();

      if (newCat !== b.category) updates.category = newCat;
      if (newType !== b.product_type) updates.product_type = newType;
      if (newName !== b.name) updates.name = newName;

      if (Object.keys(updates).length > 0) {
        await supabase.from('branches').update(updates).eq('id', b.id);
        cleaned++;
      }
    }
  }

  return NextResponse.json({ success: true, cleaned });
}
