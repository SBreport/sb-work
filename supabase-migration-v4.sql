-- ============================================
-- Migration v4: 변경 이력 추적 (assignment_logs)
-- ============================================

-- 1. 변경 이력 테이블 생성
CREATE TABLE IF NOT EXISTS assignment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_assignment_logs_assignment_id ON assignment_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_changed_at ON assignment_logs(changed_at DESC);

-- 3. RLS 활성화
ALTER TABLE assignment_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: 관리자만 조회/생성 가능
CREATE POLICY "admin_all_logs" ON assignment_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. 서비스 역할(API)에서 접근 허용
CREATE POLICY "service_role_logs" ON assignment_logs
  FOR ALL USING (true) WITH CHECK (true);
