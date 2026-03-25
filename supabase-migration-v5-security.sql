-- 프리랜서 배정 조회 정책 업데이트: optimal/inbl 역할도 포함
DROP POLICY IF EXISTS "프리랜서는 본인 배정만 조회 가능" ON assignments;

CREATE POLICY "프리랜서는 본인 배정만 조회 가능" ON assignments
  FOR SELECT USING (
    main_writer_id = auth.uid()
    OR sub_writer_id = auth.uid()
    OR optimal_writer_id = auth.uid()
    OR inbl_writer_id = auth.uid()
  );
