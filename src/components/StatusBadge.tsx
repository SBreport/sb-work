import type { AssignmentStatus } from '@/types/database';

const statusConfig: Record<AssignmentStatus, { label: string; className: string }> = {
  active: { label: '활성', className: 'bg-gray-100 text-gray-700' },
  new: { label: '신규', className: 'bg-green-100 text-green-700' },
  changed: { label: '변경', className: 'bg-yellow-100 text-yellow-700' },
  suspended: { label: '중단', className: 'bg-red-100 text-red-700' },
  hold: { label: '보류', className: 'bg-orange-100 text-orange-700' },
};

export default function StatusBadge({ status }: { status: AssignmentStatus }) {
  const config = statusConfig[status] || statusConfig.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
