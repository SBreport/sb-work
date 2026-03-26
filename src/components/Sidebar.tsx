'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building2,
  LogOut,
  Briefcase,
  FileUp,
  X,
  Eye,
  ArrowLeft,
  Megaphone,
} from 'lucide-react';

const adminMenuItems = [
  { href: '/admin/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/assignments', label: '배정 관리', icon: ClipboardList },
  { href: '/admin/writers', label: '담당자 관리', icon: Users },
  { href: '/admin/branches', label: '병원/지점 관리', icon: Building2 },
  { href: '/admin/notices', label: '공지사항', icon: Megaphone },
  { href: '/admin/import', label: '데이터 가져오기', icon: FileUp },
];

const freelancerMenuItems = [
  { href: '/my', label: '내 업무', icon: Briefcase },
];

interface SidebarProps {
  onClose?: () => void;
}

interface WriterOption {
  id: string;
  name: string;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut, isAdmin, viewAsWriterId, viewAsProfile, setViewAsWriter, isViewingAs } = useAuth();
  const [writers, setWriters] = useState<WriterOption[]>([]);
  const [showWriterSelect, setShowWriterSelect] = useState(false);

  // 관리자일 때 프리랜서 목록 로드 (한 번만)
  const writersFetched = useRef(false);
  useEffect(() => {
    if (!isAdmin || writersFetched.current) return;
    writersFetched.current = true;
    supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'freelancer')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setWriters(data || []));
  }, [isAdmin]);

  // 모드 전환 시 적절한 페이지로 이동
  const handleViewAs = (writerId: string) => {
    setViewAsWriter(writerId);
    setShowWriterSelect(false);
    router.push('/my');
    onClose?.();
  };

  const handleExitViewAs = () => {
    setViewAsWriter(null);
    router.push('/admin/dashboard');
    onClose?.();
  };

  // 현재 모드에 따라 메뉴 결정
  const isInViewMode = isAdmin && isViewingAs;
  const menuItems = isInViewMode ? freelancerMenuItems : (isAdmin ? adminMenuItems : freelancerMenuItems);

  const handleLinkClick = () => {
    onClose?.();
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">스마트브랜딩</h1>
          <p className="text-xs text-gray-500 mt-1">업무 관리</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* 프리랜서 미리보기 모드 배너 */}
      {isInViewMode && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">미리보기 모드</span>
          </div>
          <p className="text-sm font-bold text-amber-900">{viewAsProfile?.name || '로딩 중...'}</p>
          <button
            onClick={handleExitViewAs}
            className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium"
          >
            <ArrowLeft size={12} />
            관리자 모드로 돌아가기
          </button>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        {/* 관리자: 프리랜서 화면 보기 버튼 */}
        {isAdmin && !isViewingAs && (
          <div className="pt-3 mt-3 border-t border-gray-200">
            <button
              onClick={() => setShowWriterSelect(!showWriterSelect)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 w-full transition-colors"
            >
              <Eye size={18} />
              프리랜서 화면 보기
            </button>

            {showWriterSelect && (
              <div className="mt-2 max-h-48 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200">
                {writers.map(w => (
                  <button
                    key={w.id}
                    onClick={() => handleViewAs(w.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-gray-100 last:border-0"
                  >
                    {w.name}
                  </button>
                ))}
                {writers.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400">등록된 프리랜서가 없습니다.</p>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
            <p className="text-xs text-gray-500">
              {isAdmin ? '관리자' : '프리랜서'}
            </p>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="로그아웃"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
