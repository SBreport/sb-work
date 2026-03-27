-- ============================================
-- 조직도 기능: DB 스키마 마이그레이션
-- Supabase SQL Editor에서 실행
-- ⚠️ 저트래픽 시간대에 실행 권장
-- ============================================

-- 1. teams 테이블 생성
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  acting_leader_id UUID,  -- profiles FK는 아래에서 추가
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. profiles 테이블 확장
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_role TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_type TEXT DEFAULT 'internal';

-- acting_leader_id FK 추가 (profiles가 먼저 있어야 함)
ALTER TABLE teams ADD CONSTRAINT teams_acting_leader_fk
  FOREIGN KEY (acting_leader_id) REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 3. 기존 프리랜서 데이터 보정
UPDATE profiles SET employee_type = 'freelancer' WHERE role = 'freelancer' AND (employee_type IS NULL OR employee_type = 'internal');

-- 4. role 제약조건 확장 (기존 editor 역할 유지)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'editor', 'employee', 'freelancer', 'partner'));

-- 5. RLS 정책
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자 모두 SELECT 가능
CREATE POLICY teams_select ON teams FOR SELECT TO authenticated USING (true);

-- admin만 INSERT/UPDATE/DELETE
CREATE POLICY teams_insert ON teams FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY teams_update ON teams FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY teams_delete ON teams FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
