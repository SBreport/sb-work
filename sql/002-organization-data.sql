-- ============================================
-- 조직도 초기 데이터 입력
-- 001-organization-schema.sql 실행 후 진행
-- ============================================

-- 1. 팀 생성
INSERT INTO teams (name, sort_order) VALUES
  ('블로그팀', 1),
  ('바이럴팀', 2),
  ('상위노출팀', 3),
  ('브랜딩팀', 4),
  ('경영지원', 5);

-- 2. 경영진 프로필 업데이트 (team_id = NULL → 경영진으로 표시)
-- ⚠️ 아래 이름을 실제 profiles.name과 매칭해서 실행하세요

-- 최형기 - 대표
UPDATE profiles SET position = '대표', employee_type = 'internal', sort_order = 1
WHERE name = '최형기';

-- 이병준 - 이사
UPDATE profiles SET position = '이사', employee_type = 'internal', sort_order = 2
WHERE name = '이병준';

-- 신동민 - 총괄팀장
UPDATE profiles SET position = '총괄팀장', employee_type = 'internal', sort_order = 3
WHERE name = '신동민';

-- 3. 블로그팀 멤버
-- 블로그팀 팀장 부재 → acting_leader_id를 신동민으로 설정
UPDATE teams SET acting_leader_id = (SELECT id FROM profiles WHERE name = '신동민' LIMIT 1)
WHERE name = '블로그팀';

-- 사수들
UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  position = '팀원', mentor_role = '사수', employee_type = 'internal'
WHERE name IN ('오현정', '배재준', '최은주', '김보라', '강태우', '노민정')
  AND role = 'freelancer';

-- 부사수들
UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '블로그팀'),
  position = '팀원', mentor_role = '부사수', employee_type = 'internal'
WHERE name IN ('조하영', '노나경', '박주언', '서경완', '박현지', '오현주', '김차영', '김다혜')
  AND role = 'freelancer';

-- 강태우는 사수+부사수 겸임 → mentor_role은 '사수'(상위) 유지

-- 4. 바이럴팀
UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '바이럴팀'),
  position = '팀장', employee_type = 'internal'
WHERE name = '김채운';

UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '바이럴팀'),
  position = '팀원', employee_type = 'internal'
WHERE name IN ('이다건', '김유진');

-- 5. 상위노출팀
UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '상위노출팀'),
  position = '팀장', employee_type = 'internal'
WHERE name = '신준용';

-- 협력사 (일프로, 그레이스, ad드림즈)는 profiles.id가 auth.users FK이므로
-- SQL로 직접 INSERT 불가 → /admin/organization 관리 페이지에서 등록하거나
-- API를 통해 auth 계정과 함께 생성 필요

-- 6. 브랜딩팀
-- 팀장 부재 → acting_leader_id를 신동민으로 설정
UPDATE teams SET acting_leader_id = (SELECT id FROM profiles WHERE name = '신동민' LIMIT 1)
WHERE name = '브랜딩팀';

UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '브랜딩팀'),
  position = '팀원', employee_type = 'internal'
WHERE name IN ('최지원', '조안나');

-- 7. 경영지원
UPDATE profiles SET team_id = (SELECT id FROM teams WHERE name = '경영지원'),
  position = '팀원', employee_type = 'internal'
WHERE name = '김은지';

-- 8. smart 계정 (관리자 모드)
UPDATE profiles SET employee_type = 'internal' WHERE email = 'smart@gmail.com';
