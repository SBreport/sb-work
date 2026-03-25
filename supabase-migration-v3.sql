-- =============================================
-- V3 마이그레이션: 로그인 시스템 고도화
-- 1. profiles 테이블에 must_change_password 컬럼 추가
-- 2. 기존 프리랜서 계정은 true로 설정 (초기 비밀번호 변경 유도)
-- =============================================

-- 비밀번호 변경 필요 여부 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true;

-- 관리자 계정은 비밀번호 변경 불필요로 설정
UPDATE profiles SET must_change_password = false WHERE role = 'admin';

-- =============================================
-- 참고: 초기 비밀번호는 sb + 핸드폰 뒷4자리 (예: sb1234)
-- Supabase 기본 최소 비밀번호 길이(6자)를 그대로 유지
-- =============================================
