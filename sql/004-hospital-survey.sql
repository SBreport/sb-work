-- 병원 사전 설문 (SecondBrain 이슈 #68)
-- 새 표 3개만 만든다. 기존 표는 고치지 않는다.
-- 세 표 모두 RLS를 켜고 정책을 두지 않는다 = 브라우저(anon·로그인 사용자)는 읽지도 쓰지도 못한다.
-- 서버 API만 service role 키로 접근한다(service role은 RLS를 건너뛴다).
-- 되돌리기: 맨 아래 주석의 DROP 세 줄.

-- 1. 설문 링크 — 병원(지점)마다 원장용·실장용 한 개씩
CREATE TABLE survey_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 지점을 지우면 그 지점의 설문도 함께 지워진다(assignments와 같은 방식)
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('owner', 'counsel')), -- 원장용 / 상담 실장용
  token TEXT NOT NULL UNIQUE,                              -- 추측할 수 없는 무작위 값(서버가 만든다)
  nas_url TEXT CHECK (nas_url IS NULL OR nas_url LIKE 'https://%'), -- 「자료 올리기」 주소. 비면 버튼 숨김
  expires_at TIMESTAMPTZ NOT NULL,                         -- 만든 날 + 30일
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none', 'draft', 'submitted')), -- 작성 전 / 임시 저장 / 제출
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, kind)
);

-- 2. 설문 답 — 문항 ID를 키로 한 JSON 한 칸(문항이 바뀌어도 표를 고치지 않는다)
CREATE TABLE survey_answers (
  link_id UUID PRIMARY KEY REFERENCES survey_links(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_at TIMESTAMPTZ,   -- 동의 체크를 처음 저장한 시각
  saved_at TIMESTAMPTZ,     -- 마지막 임시 저장 시각
  submitted_at TIMESTAMPTZ  -- 제출 시각
);

-- 3. 계정 정보 — 서버 환경변수 키(SURVEY_SECRET_KEY)로 AES-256-GCM 암호화한 글자만 저장한다
CREATE TABLE survey_secrets (
  link_id UUID PRIMARY KEY REFERENCES survey_links(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,    -- iv.tag.ciphertext (base64url)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE survey_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_secrets ENABLE ROW LEVEL SECURITY;

-- 정책이 없어도 막히지만, 표 권한도 함께 거둔다(이중 잠금)
REVOKE ALL ON survey_links, survey_answers, survey_secrets FROM anon, authenticated;

-- 되돌리기:
-- DROP TABLE survey_secrets;
-- DROP TABLE survey_answers;
-- DROP TABLE survey_links;
