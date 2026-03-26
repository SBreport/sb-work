import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/lib/auth-guard';

export async function POST(request: NextRequest) {
  const auth = await requireAdminOnly(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { writers } = await request.json() as {
    writers: Array<{ name: string; email: string }>
  };

  const results: Array<{ name: string; email: string; success: boolean; error?: string }> = [];

  for (const w of writers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: w.email,
      password: '010',
      email_confirm: true,
      user_metadata: { name: w.name, role: 'freelancer' },
    });

    if (error) {
      results.push({ name: w.name, email: w.email, success: false, error: error.message });
    } else {
      results.push({ name: w.name, email: w.email, success: true });
      // profiles 테이블에 phone 업데이트는 트리거가 처리
    }
  }

  return NextResponse.json({
    total: writers.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
}
