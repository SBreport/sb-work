-- Additive migration: existing months retain their values and interpretation.
BEGIN;
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS package_name text,
  ADD COLUMN IF NOT EXISTS information_quantity integer CHECK (information_quantity >= 0),
  ADD COLUMN IF NOT EXISTS clinical_writer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clinical_writer_name text,
  ADD COLUMN IF NOT EXISTS clinical_quantity integer CHECK (clinical_quantity >= 0);

CREATE INDEX IF NOT EXISTS assignments_clinical_writer_idx ON public.assignments(clinical_writer_id);

DROP POLICY IF EXISTS "프리랜서는 본인 배정만 조회 가능" ON public.assignments;
CREATE POLICY "프리랜서는 본인 배정만 조회 가능" ON public.assignments
  FOR SELECT TO authenticated USING (
    main_writer_id = auth.uid() OR sub_writer_id = auth.uid()
    OR optimal_writer_id = auth.uid() OR inbl_writer_id = auth.uid()
    OR clinical_writer_id = auth.uid()
  );

-- Only the authenticated admin import API's service-role client can call this.
-- A failed insert rolls back the whole month's replacement. Matching rows keep IDs/logs.
CREATE OR REPLACE FUNCTION public.replace_month_assignments(target_month text, new_assignments jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF target_month !~ '^\d{4}-(0[1-9]|1[0-2])$' OR target_month < '2026-11'
     OR jsonb_typeof(new_assignments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid import month or payload';
  END IF;
  IF jsonb_array_length(new_assignments) = 0 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(new_assignments) a
    WHERE a->>'month' IS DISTINCT FROM target_month
  ) THEN RAISE EXCEPTION 'Empty or mixed-month import'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('assignments:' || target_month));
  DELETE FROM public.assignments a WHERE a.month = target_month AND NOT EXISTS (
    SELECT 1 FROM jsonb_populate_recordset(NULL::public.assignments, new_assignments) n
    WHERE n.branch_id = a.branch_id AND n.slot = a.slot
  );
  INSERT INTO public.assignments (
    branch_id, month, slot, renewal_day,
    main_writer_id, main_writer_name, main_quantity, main_note,
    sub_writer_id, sub_writer_name, sub_quantity, sub_note,
    optimal_writer_id, optimal_writer_name, optimal_quantity, optimal_note,
    inbl_writer_id, inbl_writer_name, inbl_quantity, inbl_note,
    status, product_type, operation_type, partner_id, package_name,
    information_quantity, clinical_writer_id, clinical_writer_name, clinical_quantity
  ) SELECT
    branch_id, month, slot, renewal_day,
    main_writer_id, main_writer_name, main_quantity, main_note,
    sub_writer_id, sub_writer_name, sub_quantity, sub_note,
    optimal_writer_id, optimal_writer_name, optimal_quantity, optimal_note,
    inbl_writer_id, inbl_writer_name, inbl_quantity, inbl_note,
    status, product_type, operation_type, partner_id, package_name,
    information_quantity, clinical_writer_id, clinical_writer_name, clinical_quantity
  FROM jsonb_populate_recordset(NULL::public.assignments, new_assignments)
  ON CONFLICT (branch_id, month, slot) DO UPDATE SET
    renewal_day = EXCLUDED.renewal_day,
    main_writer_id = EXCLUDED.main_writer_id, main_writer_name = EXCLUDED.main_writer_name,
    main_quantity = EXCLUDED.main_quantity, main_note = EXCLUDED.main_note,
    sub_writer_id = EXCLUDED.sub_writer_id, sub_writer_name = EXCLUDED.sub_writer_name,
    sub_quantity = EXCLUDED.sub_quantity, sub_note = EXCLUDED.sub_note,
    optimal_writer_id = EXCLUDED.optimal_writer_id, optimal_writer_name = EXCLUDED.optimal_writer_name,
    optimal_quantity = EXCLUDED.optimal_quantity, optimal_note = EXCLUDED.optimal_note,
    inbl_writer_id = EXCLUDED.inbl_writer_id, inbl_writer_name = EXCLUDED.inbl_writer_name,
    inbl_quantity = EXCLUDED.inbl_quantity, inbl_note = EXCLUDED.inbl_note,
    status = EXCLUDED.status, product_type = EXCLUDED.product_type,
    operation_type = EXCLUDED.operation_type, partner_id = EXCLUDED.partner_id,
    package_name = EXCLUDED.package_name, information_quantity = EXCLUDED.information_quantity,
    clinical_writer_id = EXCLUDED.clinical_writer_id, clinical_writer_name = EXCLUDED.clinical_writer_name,
    clinical_quantity = EXCLUDED.clinical_quantity;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_month_assignments(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_month_assignments(text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
