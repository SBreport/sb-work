-- ============================================================
-- 2026-04-24: 새 CSV 양식 대응 — partners 테이블 + assignments 확장
-- Supabase SQL Editor에서 순서대로 실행
-- ============================================================

-- 1. partners 테이블 생성 (수강생/대행사 마스터)
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN ('student', 'agency')),
  kakao_id text,
  kakao_link text,
  memo text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);
CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(partner_type);

-- 2. assignments 테이블 확장
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS operation_type text,
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot integer NOT NULL DEFAULT 1;

-- 3. 기존 UNIQUE 제약 교체 (branch_id, month) → (branch_id, month, slot)
-- Supabase 환경에 따라 제약 이름이 다를 수 있으니 실제 제약명을 확인 후 실행
-- 제약 확인: SELECT conname FROM pg_constraint WHERE conrelid = 'assignments'::regclass;
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'assignments'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%branch_id%month%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE assignments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_branch_month_slot_key
  ON assignments(branch_id, month, slot);

-- 4. branches 테이블에서 "/XX 수강생" 패턴 분리 → partners + branches.name 정리
-- 주의: "참조은/참조은nb"처럼 수강생 키워드 없는 케이스는 건드리지 않음
DO $$
DECLARE
  b record;
  student_name text;
  new_partner_id uuid;
  clean_branch_name text;
BEGIN
  FOR b IN SELECT id, name FROM branches WHERE name LIKE '%/%수강생%' LOOP
    -- "/" 기준으로 분리, 앞뒤 공백 제거
    clean_branch_name := trim(split_part(b.name, '/', 1));
    student_name := trim(regexp_replace(split_part(b.name, '/', 2), '\s*수강생\s*', '', 'g'));

    IF student_name = '' THEN CONTINUE; END IF;

    -- partner가 없으면 생성
    SELECT id INTO new_partner_id
    FROM partners
    WHERE name = student_name AND partner_type = 'student'
    LIMIT 1;

    IF new_partner_id IS NULL THEN
      INSERT INTO partners (name, partner_type)
      VALUES (student_name, 'student')
      RETURNING id INTO new_partner_id;
    END IF;

    -- 해당 branch의 모든 assignments에 partner_id 설정 (null인 것만)
    UPDATE assignments
    SET partner_id = new_partner_id
    WHERE branch_id = b.id AND partner_id IS NULL;

    -- branch.name 정리
    UPDATE branches SET name = clean_branch_name WHERE id = b.id;
  END LOOP;
END $$;

-- 5. branches 테이블에서 "(1)", "(2)" 패턴 분리 → slot 기반 통합
-- 동일 base name을 가진 branch들을 대표 branch로 병합하고 assignments의 slot 할당
DO $$
DECLARE
  base_name text;
  rep record;
  dup record;
  next_slot integer;
  assignment_rec record;
BEGIN
  -- base name 목록 추출 (정규식으로 괄호 숫자 제거)
  FOR base_name IN
    SELECT DISTINCT trim(regexp_replace(name, '\s*\(\d+\)\s*$', ''))
    FROM branches
    WHERE name ~ '\(\d+\)\s*$'
  LOOP
    -- 동일 base name을 가진 모든 branch들
    -- 대표 branch: 가장 오래된 것 또는 괄호 없는 버전이 있으면 그것
    SELECT * INTO rep FROM branches
    WHERE (trim(regexp_replace(name, '\s*\(\d+\)\s*$', '')) = base_name
           OR name = base_name)
    ORDER BY
      CASE WHEN name = base_name THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1;

    -- 나머지 branch들을 rep으로 병합
    FOR dup IN
      SELECT * FROM branches
      WHERE (trim(regexp_replace(name, '\s*\(\d+\)\s*$', '')) = base_name
             OR name = base_name)
        AND id != rep.id
    LOOP
      -- 각 월별로 assignments를 이관하며 slot 번호 재할당
      FOR assignment_rec IN
        SELECT * FROM assignments WHERE branch_id = dup.id ORDER BY month, id
      LOOP
        SELECT COALESCE(MAX(slot), 0) + 1 INTO next_slot
        FROM assignments
        WHERE branch_id = rep.id AND month = assignment_rec.month;

        UPDATE assignments
        SET branch_id = rep.id, slot = next_slot
        WHERE id = assignment_rec.id;
      END LOOP;

      -- 중복 branch 삭제
      DELETE FROM branches WHERE id = dup.id;
    END LOOP;

    -- 대표 branch 이름 정리 (괄호 제거)
    UPDATE branches SET name = base_name WHERE id = rep.id;
  END LOOP;
END $$;

-- 6. 검증 쿼리 (실행 결과 확인용)
-- SELECT name, count(*) FROM branches GROUP BY name HAVING count(*) > 1;  -- 중복 없어야 함
-- SELECT branch_id, month, count(*), array_agg(slot) FROM assignments GROUP BY branch_id, month HAVING count(*) > 1;  -- 분할 지점 확인
-- SELECT * FROM partners;  -- 자동 생성된 partners 확인
