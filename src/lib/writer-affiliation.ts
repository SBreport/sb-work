import type { User } from '../types/database';

export function writerAffiliation(writer: Pick<User, 'role' | 'employee_type'>): 'employee' | 'freelancer' | 'partner' {
  if (writer.employee_type) return writer.employee_type === 'internal' ? 'employee' : writer.employee_type;
  // 소속이 비어 있는 기존 계정만 권한으로 보완한다.
  if (writer.role === 'freelancer' || writer.role === 'partner') return writer.role;
  return 'employee';
}
