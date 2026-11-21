# sb-work 데이터베이스 인수인계 현황

> 작성일: 2026-08-28  
> 목적: 저장소의 초기 스키마가 아니라 실제 운영 Supabase 상태를 기준으로 개발을 시작하기 위한 문서

## 한눈에 보기

`supabase-schema.sql`은 프로젝트를 처음 만들 때의 설계도다. 이후 변경은 여러 SQL 파일로 추가됐고, 일부는 운영 DB에 적용됐지만 일부는 적용되지 않았거나 코드와 차이가 있다.

따라서 새 담당자는 다음 원칙으로 작업한다.

1. `supabase-schema.sql`만 보고 운영 DB를 재생성하지 않는다.
2. 기존 SQL 파일을 날짜나 이름만 보고 전부 다시 실행하지 않는다.
3. 운영 DB의 실제 구조를 먼저 확인한다.
4. 누락된 변경은 새 마이그레이션 한 개로 보완하고 적용 이력을 남긴다.

## 2026-08-28 운영 DB 실제 테이블

읽기 전용 PostgREST OpenAPI 조회로 확인했다.

| 테이블 | 현재 확인된 용도 |
|---|---|
| `profiles` | 로그인 사용자, 역할, 조직 정보 |
| `branches` | 지점명, 상태, 과목, 상품 유형 |
| `assignments` | 월별 지점·담당자·역할별 수량 |
| `assignment_logs` | 배정 변경 이력 |
| `cost_settings` | 담당자별 월 단가 설명과 패널티 메모 |
| `monthly_issues` | 월별 담당자 이슈 |
| `teams` | 조직 팀 |
| `partners` | 수강생·대행사 |
| `notices` | 공지사항 |
| `sheet_import_config` | 구글 시트 가져오기 설정 |

초기 스키마에 있던 `hospitals`는 현재 공개 스키마에 없으며, `branches`가 지점을 직접 관리한다.

## 코드와 운영 DB의 확인된 차이

### 운영 DB에 없는 것으로 확인된 컬럼

| 컬럼 | 코드에서 사용하는 곳 | 영향 가능성 |
|---|---|---|
| `profiles.password_skip_count` | 비밀번호 변경 건너뛰기 API | 건너뛰기 횟수 조회·저장 실패 가능 |
| `branches.renewal_day` | 지점 관리 화면·API | 지점 갱신일 저장 실패 가능 |
| `branches.start_date` | 지점 관리 화면·API | 시작일 저장 실패 가능 |
| `branches.contract_type` | 지점 관리 화면·API | 계약 방식 저장 실패 가능 |
| `branches.memo` | 지점 관리 화면·API | 지점 메모 저장 실패 가능 |

`supabase-migrations/004_password_skip_count.sql` 파일은 있지만 실제 운영 스키마에는 `password_skip_count`가 확인되지 않았다. 파일이 존재하는 것과 운영 DB에 적용된 것은 같은 의미가 아니다.

### 운영 DB에 적용된 것으로 확인되는 후속 변경

- 사수·부사수 외 `optimal`·`inbl` 담당자와 수량
- 담당자 이름 보조 컬럼
- `partners`, `partner_id`, `operation_type`, `slot`
- `assignment_logs`
- `teams`와 조직 관련 프로필 컬럼
- `notices`
- `sheet_import_config`

## SQL 파일의 의미

| 파일 | 역할 | 운영 상태 판단 |
|---|---|---|
| `supabase-schema.sql` | 최초 DB 설계 | 현재 상태 아님 |
| `supabase-migration-v2.sql` | 지점 구조 변경, optimal/inbl 추가 | 주요 컬럼 적용 확인 |
| `supabase-migration-v3.sql` | 비밀번호 강제 변경 | `must_change_password` 적용 확인 |
| `supabase-migration-v4.sql` | 배정 변경 이력 | `assignment_logs` 적용 확인 |
| `supabase-migration-v5-security.sql` | 네 역할의 본인 배정 조회 RLS | 컬럼만으로 정책 적용 여부 확인 불가 |
| `supabase-migration-notices.sql` | 공지사항 | 테이블 적용 확인 |
| `supabase-migrations/004_password_skip_count.sql` | 비밀번호 건너뛰기 횟수 | **운영 미적용으로 보임** |
| `sql/001-organization-schema.sql` | 팀·조직 프로필 확장 | 주요 컬럼 적용 확인 |
| `sql/002-organization-data.sql` | 조직 초기 데이터 | 데이터 적용 여부 별도 확인 필요 |
| `sql/003-organization-phone-update.sql` | 연락처 보정 | 데이터 적용 여부 별도 확인 필요 |
| `sql/02-assign-members.sql` | 조직원 배정 | 데이터 적용 여부 별도 확인 필요 |
| `migrations/20260424_partners_and_assignments_slot.sql` | 협력사·다중 배정 슬롯 | 적용 확인 |
| `migrations/20260522_assignment_status_check.sql` | 중단·보류 상태 허용 | CHECK 제약 별도 확인 필요 |
| `migrations/20260522_sheet_import_config.sql` | 시트 URL 저장 | 적용 확인 |

`적용 확인`은 테이블·컬럼 존재 여부를 기준으로 한 판단이다. RLS 정책, CHECK 제약, 데이터 보정 SQL의 실행 여부는 OpenAPI로 확인할 수 없다.

## 새 담당자가 먼저 할 일

1. 아래 점검 스크립트를 실행해 이 문서 이후 DB 변경 여부를 확인한다.
2. Supabase SQL Editor에서 RLS 정책과 CHECK 제약을 조회한다.
3. `password_skip_count`와 지점 확장 컬럼을 실제 기능에 계속 사용할지 결정한다.
4. 사용할 컬럼만 새 마이그레이션으로 추가한다.
5. 스테이징 또는 백업 후 적용하고 배포한다.

## 읽기 전용 점검 명령

```bash
node scripts/inspect-supabase-schema.mjs
```

또는 package script를 사용한다.

```bash
npm run schema:inspect
```

누락된 코드 참조 컬럼이 있으면 실패 처리하려면 다음을 사용한다.

```bash
node scripts/inspect-supabase-schema.mjs --strict
```

이 스크립트는 테이블이나 데이터를 변경하지 않고 구조만 조회한다. 환경변수 값도 출력하지 않는다.

RLS 정책과 CHECK 제약까지 확인할 때는 Supabase SQL Editor에서 `sql/audit-handover.sql`을 실행한다. 이 파일은 조회문만 포함하며 운영 데이터를 변경하지 않는다.

## 아직 직접 적용하지 않은 이유

운영 DB에 컬럼을 추가하는 것은 실제 서비스 데이터를 변경하는 작업이다. 특히 지점의 갱신일이 `assignments.renewal_day`와 `branches.renewal_day` 중 어디에 있어야 하는지는 업무 규칙 결정이 필요하다. 인수인계 준비 단계에서는 운영 DB를 임의 변경하지 않고 차이를 문서화하는 것이 안전하다.

정산 기능을 구현할 때는 기존 `assignments.status`를 재사용하지 않는다. 자동 배정안 승인 상태와 청구·지급 상태는 각각 별도 기록으로 관리하고, 작업 결과는 기존 노션에서 확인한다.
