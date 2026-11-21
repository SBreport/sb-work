import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.');
  process.exit(1);
}

const response = await fetch(`${url}/rest/v1/`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/openapi+json',
  },
});

if (!response.ok) {
  console.error(`Supabase 스키마 조회 실패: HTTP ${response.status}`);
  process.exit(1);
}

const spec = await response.json();
const schemas = spec.definitions || spec.components?.schemas || {};

console.log(`# 운영 Supabase 공개 스키마\n`);
console.log(`확인 시각: ${new Date().toISOString()}\n`);

for (const table of Object.keys(schemas).sort()) {
  const columns = Object.keys(schemas[table]?.properties || {});
  if (columns.length) console.log(`- **${table}**: ${columns.join(', ')}`);
}

const expectedByCode = {
  profiles: ['password_skip_count'],
  branches: ['renewal_day', 'start_date', 'contract_type', 'memo'],
  assignments: [
    'optimal_writer_id', 'optimal_quantity', 'inbl_writer_id', 'inbl_quantity',
    'operation_type', 'partner_id', 'slot',
  ],
};

const missing = [];
for (const [table, columns] of Object.entries(expectedByCode)) {
  const actual = schemas[table]?.properties || {};
  for (const column of columns) {
    if (!(column in actual)) missing.push(`${table}.${column}`);
  }
}

console.log(`\n## 코드와 비교\n`);
if (missing.length) {
  console.log('코드가 참조하지만 운영 스키마에서 확인되지 않은 컬럼:');
  for (const item of missing) console.log(`- ${item}`);
  if (process.argv.includes('--strict')) process.exitCode = 2;
} else {
  console.log('점검 대상 컬럼이 모두 운영 스키마에 존재합니다.');
}

console.log('\n> 이 점검은 테이블·컬럼만 확인합니다. RLS 정책과 CHECK 제약은 Supabase SQL Editor에서 별도 확인해야 합니다.');
