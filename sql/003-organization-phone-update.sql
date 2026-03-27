-- ============================================
-- 조직도 연락처 + 팀/직위 업데이트
-- 002-organization-data.sql 실행 후 진행
-- ============================================

-- ============================================
-- STEP 1: 기존 profiles 연락처(phone) 업데이트
-- ============================================

-- 이병준 (이사)
UPDATE profiles SET phone = '010-6669-1793'
WHERE email = 'leebjz2012@gmail.com';

-- 신동민 (총괄팀장)
UPDATE profiles SET phone = '010-9722-2357'
WHERE email = 'twlibraryst@gmail.com';

-- 안형원 (프로젝트 매니저 → 바이럴팀 팀원으로 배치)
UPDATE profiles SET phone = '010-9608-3454'
WHERE email = 'anhyeongwon4@gmail.com';

-- 신준용 (상위노출팀 팀장)
UPDATE profiles SET phone = '010-8361-4938'
WHERE email = 'magimist001@gmail.com';

-- 이다건 (바이럴팀 팀원)
UPDATE profiles SET phone = '010-4173-2368'
WHERE email = 'a41732368@gmail.com';

-- 김유진 (바이럴팀 팀원)
UPDATE profiles SET phone = '010-9597-7218'
WHERE email = 'lcukuj@gmail.com';

-- 김은지 (경영지원)
UPDATE profiles SET phone = NULL  -- 연락처 미제공
WHERE email = 'djc486@naver.com';

-- ============================================
-- STEP 2: auth 계정이 없는 직원 → 계정 생성 필요
-- 아래 인원은 SQL로 직접 INSERT 불가 (profiles.id FK → auth.users)
-- /api/bulk-create-writers 또는 Supabase Admin에서 계정 생성 필요
-- ============================================
-- 최형기 (대표) - 010-2824-1794 - 이메일 미확인
-- 최지원 (브랜딩팀 디자이너) - 010-6374-9318 - 이메일 미확인
-- 조안나 (브랜딩팀 디자이너) - 010-9958-7404 - 이메일 미확인
-- 김채운 (바이럴팀 팀장) - 010-9703-3842 - 이메일 미확인

-- ============================================
-- STEP 3: 안형원 팀 배치 (스크린샷에 있지만 002에서 누락)
-- ============================================
-- 안형원의 역할이 확인되면 아래 주석 해제
-- UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '바이럴팀'),
--   position = '팀원', employee_type = 'internal'
-- WHERE email = 'anhyeongwon4@gmail.com';
