import { workRolesFor, type BlogAssignment } from './blog-assignment';

export const PREVIEW_WORK_START_MONTH = '2026-08';

export function eligiblePreviewWriterIds(assignments: BlogAssignment[]): Set<string> {
  const eligible = new Set<string>();
  for (const assignment of assignments) {
    if ((assignment.month || '') < PREVIEW_WORK_START_MONTH) continue;
    const ids = new Set([
      assignment.main_writer_id, assignment.sub_writer_id, assignment.optimal_writer_id,
      assignment.inbl_writer_id, assignment.clinical_writer_id,
    ]);
    for (const id of ids) {
      if (id && workRolesFor(assignment, id).some(role => role.qty > 0)) eligible.add(id);
    }
  }
  return eligible;
}
