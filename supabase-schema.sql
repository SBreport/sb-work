-- =============================================
-- 스마트브랜딩 업무분장 웹앱 - Supabase DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 사용자 프로필 테이블 (Supabase Auth와 연동)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'freelancer' CHECK (role IN ('admin', 'freelancer')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 병원 테이블
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 피부과, 내과, 산부인과, 한의원, 성형외과 등
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 지점 테이블
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 광명, 대전, 대구 등
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 배정 테이블 (핵심)
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- '2026-04' 형식
  renewal_day INTEGER NOT NULL DEFAULT 1, -- 갱신일
  main_writer_id UUID REFERENCES profiles(id),
  sub_writer_id UUID REFERENCES profiles(id),
  main_quantity INTEGER NOT NULL DEFAULT 0,
  sub_quantity INTEGER NOT NULL DEFAULT 0,
  optimal_distribution INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'new', 'changed', 'terminated', 'ai', 'both')),
  main_note TEXT,
  sub_note TEXT,
  note TEXT,
  product_type TEXT, -- 솔루션, 로컬 등
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 인건비 설정 테이블
CREATE TABLE cost_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('main', 'sub')),
  month TEXT NOT NULL,
  base_rate TEXT, -- 예: '7.5 + 매출 4%'
  penalty_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(writer_id, role, month)
);

-- 6. 월간 이슈 테이블
CREATE TABLE monthly_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  writer_id UUID REFERENCES profiles(id),
  description TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX idx_assignments_month ON assignments(month);
CREATE INDEX idx_assignments_main_writer ON assignments(main_writer_id);
CREATE INDEX idx_assignments_sub_writer ON assignments(sub_writer_id);
CREATE INDEX idx_assignments_branch ON assignments(branch_id);
CREATE INDEX idx_branches_hospital ON branches(hospital_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- profiles 테이블 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자는 모든 프로필 조회 가능" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "본인 프로필 조회 가능" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "관리자만 프로필 수정 가능" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- hospitals 테이블 RLS
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "모든 인증 사용자가 병원 조회 가능" ON hospitals
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "관리자만 병원 관리 가능" ON hospitals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- branches 테이블 RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "모든 인증 사용자가 지점 조회 가능" ON branches
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "관리자만 지점 관리 가능" ON branches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- assignments 테이블 RLS (핵심!)
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자는 모든 배정 조회 가능" ON assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "프리랜서는 본인 배정만 조회 가능" ON assignments
  FOR SELECT USING (
    main_writer_id = auth.uid() OR sub_writer_id = auth.uid()
  );

CREATE POLICY "관리자만 배정 관리 가능" ON assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- cost_settings 테이블 RLS
ALTER TABLE cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자는 모든 인건비 조회 가능" ON cost_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "프리랜서는 본인 인건비만 조회 가능" ON cost_settings
  FOR SELECT USING (writer_id = auth.uid());

CREATE POLICY "관리자만 인건비 관리 가능" ON cost_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- monthly_issues 테이블 RLS
ALTER TABLE monthly_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자는 모든 이슈 관리 가능" ON monthly_issues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 트리거: 새 사용자 가입 시 profiles 자동 생성
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'freelancer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
