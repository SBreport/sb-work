// 일회성: admin 계정 비밀번호 직접 재설정
// 사용법: node --env-file=.env.local scripts/reset-admin-password.mjs <새비밀번호>
// 예시:   node --env-file=.env.local scripts/reset-admin-password.mjs MyNew2026!

import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'barndingsmart@gmail.com';
const NEW_PASSWORD = process.argv[2];

if (!NEW_PASSWORD || NEW_PASSWORD.length < 6) {
  console.error('❌ 사용법: node --env-file=.env.local scripts/reset-admin-password.mjs <새비밀번호>');
  console.error('   비밀번호는 최소 6자 이상이어야 합니다.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ 환경 변수가 로드되지 않았습니다.');
  console.error('   다음 명령으로 실행하세요:');
  console.error('   node --env-file=.env.local scripts/reset-admin-password.mjs <비밀번호>');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

console.log(`🔍 ${ADMIN_EMAIL} 계정 검색 중...`);

const { data, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('❌ 사용자 목록 조회 실패:', listError.message);
  process.exit(1);
}

const admin = data.users.find(u => u.email === ADMIN_EMAIL);
if (!admin) {
  console.error(`❌ ${ADMIN_EMAIL} 계정을 찾을 수 없습니다.`);
  console.error('   존재하는 사용자 이메일 목록:');
  data.users.forEach(u => console.error(`   - ${u.email}`));
  process.exit(1);
}

console.log(`✓ 계정 찾음 (id: ${admin.id})`);
console.log('🔧 비밀번호 재설정 중...');

const { error: updateError } = await supabase.auth.admin.updateUserById(admin.id, {
  password: NEW_PASSWORD,
});

if (updateError) {
  console.error('❌ 비밀번호 재설정 실패:', updateError.message);
  process.exit(1);
}

console.log(`✅ ${ADMIN_EMAIL} 비밀번호가 성공적으로 재설정됐습니다.`);
console.log(`   이제 새 비밀번호로 로그인하세요.`);
