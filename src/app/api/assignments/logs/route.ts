import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get('assignment_id');
  const month = searchParams.get('month');
  const limit = Number(searchParams.get('limit')) || 50;

  let query = supabase
    .from('assignment_logs')
    .select(`
      *,
      changed_by_profile:profiles!assignment_logs_changed_by_fkey(name)
    `)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (assignmentId) {
    query = query.eq('assignment_id', assignmentId);
  }

  if (month) {
    // 해당 월의 배정에 대한 로그만
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('month', month);

    if (assignments && assignments.length > 0) {
      const ids = assignments.map(a => a.id);
      query = query.in('assignment_id', ids);
    } else {
      return NextResponse.json({ logs: [] });
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ logs: data || [] });
}
