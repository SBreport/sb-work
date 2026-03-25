-- =============================================
-- V2 마이그레이션: 구조 변경
-- 1. hospitals 테이블 제거, branches에 태그 직접 부여
-- 2. assignments에 최적배포/인블 역할 추가
-- =============================================

-- 기존 데이터 전부 삭제 (초기화 후 재시작)
DELETE FROM assignments;
DELETE FROM cost_settings;
DELETE FROM monthly_issues;
DELETE FROM branches;
DELETE FROM hospitals;

-- hospitals 테이블의 외래키 제거 후 branches 구조 변경
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_hospital_id_fkey;
ALTER TABLE branches DROP COLUMN IF EXISTS hospital_id;

-- branches에 분류 태그 컬럼 추가
ALTER TABLE branches ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT '';
-- category: 피부과, 내과, 산부인과, 한의원, 성형외과, 치과, 세무법인 등
-- product_type: 유앤아이, 로컬, 솔루션 등

-- hospitals 테이블 삭제
DROP TABLE IF EXISTS hospitals CASCADE;

-- assignments 테이블에 최적배포/인블 역할 추가
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS optimal_writer_id UUID REFERENCES profiles(id);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS optimal_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS optimal_note TEXT;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS inbl_writer_id UUID REFERENCES profiles(id);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS inbl_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS inbl_note TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_assignments_optimal_writer ON assignments(optimal_writer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_inbl_writer ON assignments(inbl_writer_id);
CREATE INDEX IF NOT EXISTS idx_branches_category ON branches(category);
CREATE INDEX IF NOT EXISTS idx_branches_product_type ON branches(product_type);

-- =============================================
-- RLS 정책 업데이트 (branches - hospitals 관련 제거 불필요, 기존 유지)
-- =============================================
