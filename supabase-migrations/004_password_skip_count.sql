-- 비밀번호 변경 건너뛰기 횟수 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_skip_count integer DEFAULT 0;
