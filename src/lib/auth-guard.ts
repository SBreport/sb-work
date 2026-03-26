import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API 라우트에서 관리자 인증 확인
 * - 요청의 Authorization 헤더 또는 쿠키에서 access_token 추출
 * - Supabase로 유저 확인 후 admin인지 검증
 * - 실패 시 401/403 반환
 */
export async function requireAdmin(request: NextRequest): Promise<{ authorized: true; userId: string } | NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Authorization 헤더에서 토큰 추출
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.replace('Bearer ', '');

  // 헤더에 없으면 쿠키에서 찾기
  if (!token) {
    const cookies = request.cookies;
    // Supabase의 기본 쿠키 이름
    const sbCookie = cookies.get('sb-access-token')?.value
      || cookies.getAll().find(c => c.name.includes('auth-token'))?.value;
    token = sbCookie || undefined;
  }

  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // anon key로 사용자 확인
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: '유효하지 않은 인증 정보입니다.' }, { status: 401 });
  }

  // service role로 프로필 확인
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  return { authorized: true, userId: user.id };
}

/**
 * 순수 admin만 허용 (위험한 API: 데이터 가져오기, 리셋 등)
 */
export async function requireAdminOnly(request: NextRequest): Promise<{ authorized: true; userId: string } | NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
    global: { headers: { Authorization: `Bearer ${token}` } }
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: '최고 관리자 권한이 필요합니다.' }, { status: 403 });
  }

  return { authorized: true, userId: user.id };
}
