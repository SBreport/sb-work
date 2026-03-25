-- 공지사항 테이블
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  month TEXT, -- 특정 월에만 표시 (null이면 항상 표시)
  is_pinned BOOLEAN DEFAULT false, -- 상단 고정
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- 모든 로그인 사용자가 활성 공지 조회 가능
CREATE POLICY "notices_read" ON notices
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- 관리자만 공지 생성/수정/삭제
CREATE POLICY "notices_admin_insert" ON notices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "notices_admin_update" ON notices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "notices_admin_delete" ON notices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
