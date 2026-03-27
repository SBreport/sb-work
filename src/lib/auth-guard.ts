import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/* ── 공통: 토큰 추출 + 사용자/프로필 확인 ── */
async function extractAuthUser(request: NextRequest): Promise<
  { userId: string; role: string } | NextResponse
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Authorization 헤더 → 쿠키 순으로 토큰 추출
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.replace('Bearer ', '');
  if (!token) {
    const cookies = request.cookies;
    const sbCookie = cookies.get('sb-access-token')?.value
      || cookies.getAll().find(c => c.name.includes('auth-token'))?.value;
    token = sbCookie || undefined;
  }

  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: '유효하지 않은 인증 정보입니다.' }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  }

  return { userId: user.id, role: profile.role };
}

/**
 * 로그인한 모든 사용자 허용 (조직도 등 공통 API용)
 */
export async function requireAuth(request: NextRequest): Promise<{ authorized: true; userId: string; role: string } | NextResponse> {
  const result = await extractAuthUser(request);
  if (result instanceof NextResponse) return result;
  return { authorized: true, ...result };
}

/**
 * admin 또는 editor 허용
 */
export async function requireAdmin(request: NextRequest): Promise<{ authorized: true; userId: string } | NextResponse> {
  const result = await extractAuthUser(request);
  if (result instanceof NextResponse) return result;
  if (result.role !== 'admin' && result.role !== 'editor') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }
  return { authorized: true, userId: result.userId };
}

/**
 * 순수 admin만 허용 (위험한 API: 데이터 가져오기, 리셋 등)
 */
export async function requireAdminOnly(request: NextRequest): Promise<{ authorized: true; userId: string } | NextResponse> {
  const result = await extractAuthUser(request);
  if (result instanceof NextResponse) return result;
  if (result.role !== 'admin') {
    return NextResponse.json({ error: '최고 관리자 권한이 필요합니다.' }, { status: 403 });
  }
  return { authorized: true, userId: result.userId };
}
