-- 2026-05-22: 구글 시트 가져오기 — 저장된 시트 URL 1개를 보관
CREATE TABLE IF NOT EXISTS sheet_import_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  url TEXT,
  last_imported_month TEXT,
  last_imported_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO sheet_import_config (id) VALUES (1) ON CONFLICT DO NOTHING;
