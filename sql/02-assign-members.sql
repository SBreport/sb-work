-- ============================================
-- 팀 멤버 배정 + 직위/멘토역할 설정
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. smart 계정 삭제 (테스트 계정)
-- profiles에서 먼저 삭제 (FK 제약)
DELETE FROM profiles WHERE email = 'smartbranding0@gmail.com';
-- auth.users에서도 삭제
DELETE FROM auth.users WHERE email = 'smartbranding0@gmail.com';

-- 2. admin 계정은 employee_type을 명시적으로 설정 (조직도 비노출)
UPDATE profiles SET employee_type = 'internal' WHERE role = 'admin';
-- admin은 API에서 role='admin' 필터로 제외됨

-- ============================================
-- 3. 경영진 (team_id = NULL, 팀 미소속)
-- ============================================
-- 최형기 (대표)
UPDATE profiles SET position = '대표', employee_type = 'internal', sort_order = 1
WHERE email = 'sbconsulting7890@gmail.com';

-- 이병준 (이사)
UPDATE profiles SET position = '이사', employee_type = 'internal', sort_order = 2
WHERE email = 'leebjz2012@gmail.com';

-- 신동민 (총괄팀장)
UPDATE profiles SET position = '총괄팀장', employee_type = 'internal', sort_order = 3
WHERE email = 'twlibraryst@gmail.com';

-- ============================================
-- 4. 블로그팀 멤버 배정
-- ============================================
-- 사수들
UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '사수', employee_type = 'freelancer', sort_order = 1
WHERE email = 'xdxdxden@gmail.com'; -- 오현정

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '사수', employee_type = 'freelancer', sort_order = 2
WHERE email = 'ironmindtiger@gmail.com'; -- 배재준

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '사수', employee_type = 'freelancer', sort_order = 3
WHERE email = 'ashleyuu07@gmail.com'; -- 최은주

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '사수', employee_type = 'freelancer', sort_order = 4
WHERE email = 'bora0091@gmail.com'; -- 김보라

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '사수', employee_type = 'freelancer', sort_order = 5
WHERE email = 'bighouse2722@gmail.com'; -- 강태우

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '사수', employee_type = 'freelancer', sort_order = 6
WHERE email = 'hedger123@naver.com'; -- 노민정

-- 부사수들
UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 10
WHERE email = 'smile.haong@gmail.com'; -- 조하영

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 11
WHERE email = 'nona9797@naver.com'; -- 노나경

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 12
WHERE email = 'jueon920924@gmail.com'; -- 박주언

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 13
WHERE email = 'jaram0107@gmail.com'; -- 서경완

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 14
WHERE email = 'guswl01031589210@gmail.com'; -- 박현지

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 15
WHERE email = 'hyu9512@gmail.com'; -- 오현주

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 16
WHERE email = 'gmsma516@gmail.com'; -- 김차영

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  mentor_role = '부사수', employee_type = 'freelancer', sort_order = 17
WHERE email = 'dhrkawk47@gmail.com'; -- 김다혜

-- 블로그팀 팀장 부재 → 신동민 직무대행 설정
UPDATE teams SET acting_leader_id = (
  SELECT id FROM profiles WHERE email = 'twlibraryst@gmail.com'
) WHERE name = '블로그팀';

-- ============================================
-- 5. 바이럴팀 멤버 배정
-- ============================================
UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '바이럴팀'),
  position = '팀장', employee_type = 'internal', sort_order = 1
WHERE email = 'cwkim5008@gmail.com'; -- 김채운

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '바이럴팀'),
  position = '팀원', employee_type = 'internal', sort_order = 2
WHERE email = 'a41732368@gmail.com'; -- 이다건

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '바이럴팀'),
  position = '팀원', employee_type = 'internal', sort_order = 3
WHERE email = 'lcukuj@gmail.com'; -- 김유진

-- ============================================
-- 6. 상위노출팀 멤버 배정
-- ============================================
UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '상위노출팀'),
  position = '팀장', employee_type = 'internal', sort_order = 1
WHERE email = 'magimist001@gmail.com'; -- 신준용

-- ============================================
-- 7. 브랜딩팀 멤버 배정
-- ============================================
UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '브랜딩팀'),
  position = '팀원', employee_type = 'internal', sort_order = 1
WHERE email = 'wldhd222@gmail.com'; -- 최지원

UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '브랜딩팀'),
  position = '팀원', employee_type = 'internal', sort_order = 2
WHERE email = 'vvip7404@gmail.com'; -- 조안나

-- 브랜딩팀 팀장 부재 → 신동민 직무대행 설정
UPDATE teams SET acting_leader_id = (
  SELECT id FROM profiles WHERE email = 'twlibraryst@gmail.com'
) WHERE name = '브랜딩팀';

-- ============================================
-- 8. 경영지원 멤버 배정
-- ============================================
UPDATE profiles SET
  team_id = (SELECT id FROM teams WHERE name = '경영지원'),
  position = '팀원', employee_type = 'internal', sort_order = 1
WHERE email = 'djc486@naver.com'; -- 김은지

-- ============================================
-- 9. 안형원 — 프로젝트 매니저 (경영진 또는 별도 배치)
-- ============================================
UPDATE profiles SET
  position = '팀원', employee_type = 'internal', sort_order = 4
WHERE email = 'anhyeongwon4@gmail.com'; -- 안형원 (팀 미소속 → 경영진에 표시)

-- ============================================
-- 10. 연락처(전화번호) 입력
-- ============================================
UPDATE profiles SET phone = '010-2824-1794' WHERE email = 'sbconsulting7890@gmail.com'; -- 최형기
UPDATE profiles SET phone = '010-6669-1793' WHERE email = 'leebjz2012@gmail.com'; -- 이병준
UPDATE profiles SET phone = '010-9722-2357' WHERE email = 'twlibraryst@gmail.com'; -- 신동민
UPDATE profiles SET phone = '010-9608-3454' WHERE email = 'anhyeongwon4@gmail.com'; -- 안형원
UPDATE profiles SET phone = '010-8361-4938' WHERE email = 'magimist001@gmail.com'; -- 신준용
UPDATE profiles SET phone = '010-4173-2368' WHERE email = 'a41732368@gmail.com'; -- 이다건
UPDATE profiles SET phone = '010-9597-7218' WHERE email = 'lcukuj@gmail.com'; -- 김유진
UPDATE profiles SET phone = '010-6374-9318' WHERE email = 'wldhd222@gmail.com'; -- 최지원
UPDATE profiles SET phone = '010-9958-7404' WHERE email = 'vvip7404@gmail.com'; -- 조안나
UPDATE profiles SET phone = '010-9703-3842' WHERE email = 'cwkim5008@gmail.com'; -- 김채운
