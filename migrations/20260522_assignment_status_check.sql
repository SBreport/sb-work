-- 2026-05-22: assignments.status CHECK 제약에 'suspended'(중단)·'hold'(보류) 추가
--
-- [배경]
-- 진행여부 상태를 신규/변경/중단/보류로 개편하면서 importer가 status에
-- 'suspended'(중단·해지) / 'hold'(보류)를 쓰게 됐는데, assignments.status
-- 컬럼의 CHECK 제약은 옛 값만 허용했다:
--   CHECK (status IN ('active','new','changed','terminated','ai','both'))
-- → P열에 중단/해지/보류가 포함된 CSV를 import하면 해당 행이 제약을 위반,
--   50행 단위 batch insert가 통째로 실패하여 데이터가 누락됐음.
--
-- [적용 방법]
-- Supabase 대시보드 → SQL Editor에서 아래 두 줄을 실행.
-- 기존 값(terminated/ai/both)까지 포함한 superset이라 기존 데이터는 안전하다.

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_status_check
  CHECK (status IN ('active', 'new', 'changed', 'terminated', 'ai', 'both', 'suspended', 'hold'));
