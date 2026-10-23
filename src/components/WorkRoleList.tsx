import { Fragment } from 'react';
import type { WorkRole } from '@/lib/blog-assignment';

export const WORK_ROLE_STYLES: Record<string, { label: string; className: string }> = {
  '네이버 블로그': { label: '네이버 블로그', className: 'bg-[#F0F9F3] text-[#1F2937] border-[#DCEEE2]' },
  'SEO 콘텐츠': { label: 'SEO 콘텐츠', className: 'bg-[#F0F5FC] text-[#1F2937] border-[#DFE8F5]' },
  '블로그(임상/논문)': { label: '임상·논문', className: 'bg-[#F6F6F7] text-[#1F2937] border-[#E9E9EC]' },
  '블로그(정보성)': { label: '정보성', className: 'bg-[#FFF6EE] text-[#1F2937] border-[#F5E7DB]' },
};

export default function WorkRoleList({ roles }: { roles: WorkRole[] }) {
  return (
    <div className="inline-grid grid-cols-[7rem_auto] items-center gap-x-3 gap-y-1.5 text-left">
      {roles.map(role => {
        const style = WORK_ROLE_STYLES[role.label];
        return (
          <Fragment key={role.label}>
            <span className={`rounded-full border px-2 py-0.5 text-center text-[11px] font-medium leading-4 whitespace-nowrap ${style?.className || 'bg-gray-50 text-[#1F2937] border-gray-200'}`}>
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
