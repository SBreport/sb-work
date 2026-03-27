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
  Network,
  ChevronDown,
  Settings,
  UserCircle,
  Handshake,
} from 'lucide-react';

// ── 공통 메뉴: 모든 로그인 사용자 ──
const commonMenuItems = [
  { href: '/notices', label: '공지사항', icon: Megaphone },
  { href: '/organization', label: '조직도', icon: Network },
  { href: '/clients', label: '클라이언트', icon: UserCircle },
  { href: '/partners', label: '협력사', icon: Handshake },
];

// ── 프리랜서 전용 ──
const freelancerExtraItems = [
  { href: '/my', label: '내 업무', icon: Briefcase },
];

// ── 관리 하위 메뉴 (접힘/열림) ──
const adminSubItems = [
  { href: '/admin/notices', label: '공지사항 관리', icon: Megaphone },
  { href: '/admin/organization', label: '조직도 수정', icon: Network },
  { href: '/admin/assignments', label: '블로그 업무 배정', icon: ClipboardList },
  { href: '/admin/writers', label: '계정 관리', icon: Users },
  { href: '/admin/branches', label: '지점 현황', icon: Building2 },
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
  const { profile, signOut, isAdmin, isEditor, isEmployee, viewAsWriterId, viewAsProfile, setViewAsWriter, isViewingAs } = useAuth();
  const [writers, setWriters] = useState<WriterOption[]>([]);
  const [showWriterSelect, setShowWriterSelect] = useState(false);
  // 관리 하위메뉴: 현재 관리 페이지에 있으면 열림, 아니면 닫힘
  const [managementOpen, setManagementOpen] = useState(false);

  // 현재 관리 페이지에 있으면 자동으로 열기
  useEffect(() => {
    const isOnAdminSub = adminSubItems.some(item => pathname.startsWith(item.href));
    if (isOnAdminSub) setManagementOpen(true);
  }, [pathname]);

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

  const handleLinkClick = () => {
    onClose?.();
  };

  // 프리랜서 여부 (admin, editor, employee가 아닌 경우)
  const isFreelancer = !isAdmin && !isEmployee;

  // 미리보기 모드
  const isInViewMode = isAdmin && isViewingAs;

  const renderMenuItem = (item: { href: string; label: string; icon: React.ComponentType<{ size?: number }> }) => {
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
  };

  // editor는 데이터 가져오기 숨김
  const showImport = isAdmin && !isEditor;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">스마트브랜딩</h1>
          <p className="text-xs text-gray-500 mt-1">업무 관리 페이지</p>
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

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* ── 공통 메뉴 ── */}
        {commonMenuItems.map(renderMenuItem)}

        {/* ── 프리랜서 전용: 내 업무 ── */}
        {(isFreelancer || isInViewMode) && freelancerExtraItems.map(renderMenuItem)}

        {/* ── 관리자 메뉴 (admin/editor, 미리보기 모드가 아닐 때) ── */}
        {isAdmin && !isInViewMode && (
          <>
            <div className="pt-3 mt-3 border-t border-gray-200" />

            {/* 대시보드 */}
            {renderMenuItem({ href: '/dashboard', label: '대시보드', icon: LayoutDashboard })}

            {/* 관리 (접힘/열림) */}
            <button
              onClick={() => setManagementOpen(!managementOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                managementOpen ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings size={18} />
              <span className="flex-1 text-left">관리</span>
              <ChevronDown size={14} className={`transition-transform ${managementOpen ? 'rotate-180' : ''}`} />
            </button>

            {managementOpen && (
              <div className="ml-4 pl-3 border-l-2 border-gray-100 space-y-0.5">
                {adminSubItems.map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'text-blue-700 font-semibold bg-blue-50'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                      }`}
                    >
                      <Icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* 데이터 가져오기 (admin만) */}
            {showImport && renderMenuItem({ href: '/admin/import', label: '데이터 가져오기', icon: FileUp })}
          </>
        )}

        {/* 관리자: 프리랜서 화면 보기 */}
        {isAdmin && !isInViewMode && (
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
              {isEditor ? '편집자' : isAdmin ? '관리자' : isEmployee ? '직원' : '프리랜서'}
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
