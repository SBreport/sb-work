import { Fragment } from 'react';
import type { WorkRole } from '@/lib/blog-assignment';

export const WORK_ROLE_STYLES: Record<string, { label: string; className: string }> = {
  '네이버 블로그': { label: '네이버 블로그', className: 'bg-[#BBF7D0] text-[#1F2937] border-black/10' },
  'SEO 콘텐츠': { label: 'SEO 콘텐츠', className: 'bg-[#BFDBFE] text-[#1F2937] border-black/10' },
  '블로그(임상/논문)': { label: '임상·논문', className: 'bg-[#D1D5DB] text-[#1F2937] border-black/10' },
  '블로그(정보성)': { label: '정보성', className: 'bg-[#FED7AA] text-[#1F2937] border-black/10' },
};

export default function WorkRoleList({ roles }: { roles: WorkRole[] }) {
  return (
    <div className="inline-grid grid-cols-[7rem_auto] items-center gap-x-3 gap-y-1.5 text-left">
      {roles.map(role => {
        const style = WORK_ROLE_STYLES[role.label];
        return (
          <Fragment key={role.label}>
            <span className={`rounded border px-2 py-1 text-center text-[11px] font-medium leading-4 whitespace-nowrap ${style?.className || 'bg-gray-50 text-[#1F2937] border-gray-200'}`}>
              {style?.label || role.label}
            </span>
            <span className="min-w-10 text-right text-sm font-semibold tabular-nums text-[#1F2937]">
              {role.qty}<span className="ml-0.5 text-xs font-normal">건</span>
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
