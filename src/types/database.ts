export type UserRole = 'admin' | 'editor' | 'employee' | 'freelancer' | 'partner';

export type AssignmentStatus = 'active' | 'new' | 'changed' | 'terminated' | 'ai' | 'both';

export type ContractType = 'freelancer' | 'business';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  contract_type: ContractType;
  phone?: string;
  is_active: boolean;
  must_change_password: boolean;
  password_skip_count: number;
  contract_start?: string | null;
  contract_end?: string | null;
  // 조직도 관련
  team_id?: string | null;
  position?: string | null;       // '대표', '이사', '총괄팀장', '팀장', '팀원'
  mentor_role?: string | null;    // '사수', '부사수'
  sort_order?: number;
  employee_type?: 'internal' | 'freelancer' | 'partner';
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  sort_order: number;
  acting_leader_id: string | null;
  acting_leader?: User;
  created_at: string;
  members?: User[];
}

export interface Branch {
  id: string;
  name: string;            // 지점명 (유앤아이 광명, 로벨의원 등)
  category: string;         // 과목 태그 (피부과, 내과, 성형외과 등)
  product_type: string;     // 유형 태그 (유앤아이, 로컬, 솔루션, 대행 등)
  status: 'active' | 'terminated';
  renewal_day?: number;     // 갱신일 (1~31)
  start_date?: string;      // 작업 시작일 (YYYY-MM-DD)
  contract_type?: string;   // 계약 방식 (월정액, 건당 등)
  memo?: string;            // 비고/메모
  created_at: string;
}

export interface Assignment {
  id: string;
  branch_id: string;
  month: string; // '2026-04' 형식
  renewal_day: number;
  // 사수 (E-G)
  main_writer_id: string | null;
  main_writer_name: string | null;
  main_quantity: number;
  main_note: string | null;
  // 부사수 (H-J)
  sub_writer_id: string | null;
  sub_writer_name: string | null;
  sub_quantity: number;
  sub_note: string | null;
  // 최적배포 (K-M)
  optimal_writer_id: string | null;
  optimal_writer_name: string | null;
  optimal_quantity: number;
  optimal_note: string | null;
  // 인블 (신규)
  inbl_writer_id: string | null;
  inbl_writer_name: string | null;
  inbl_quantity: number;
  inbl_note: string | null;

  status: AssignmentStatus;
  note: string | null;
  product_type: string | null;
  created_at: string;
  // joined
  branch?: Branch;
  main_writer?: User;
  sub_writer?: User;
  optimal_writer?: User;
  inbl_writer?: User;
}

export interface WriterSummary {
  writer_id: string;
  writer_name: string;
  role: 'main' | 'sub' | 'optimal' | 'inbl';
  total_quantity: number;
}

export interface MonthlyIssue {
  id: string;
  month: string;
  writer_id: string | null;
  description: string;
  resolved: boolean;
  created_at: string;
  writer?: User;
}
