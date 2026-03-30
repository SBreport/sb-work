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
  FolderOpen,
  KeyRound,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const PasswordChangeModal = dynamic(() => import('./PasswordChangeModal'), { ssr: false });

// ── 공통 메뉴: 모든 로그인 사용자 ──
const commonMenuItems = [
  { href: '/notices', label: '공지사항', icon: Megaphone },
  { href: '/organization', label: '조직도', icon: Network },
  { href: '/clients', label: '클라이언트', icon: UserCircle },
  { href: '/partners', label: '협력사', icon: Handshake },
  { href: '/library', label: '자료실', icon: FolderOpen },
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
  { href: '/admin/import', label: '데이터 가져오기', icon: FileUp },
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
  const { profile, signOut, isAdmin, isEditor, isEmployee, viewAsId, viewAsProfile, viewAsRole, setViewAs, isViewingAs } = useAuth();
  const [writers, setWriters] = useState<WriterOption[]>([]);
  const [employees, setEmployees] = useState<WriterOption[]>([]);
  // 관리 하위메뉴
  const [managementOpen, setManagementOpen] = useState(false);
  // 미리보기 하위메뉴
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showFreelancerList, setShowFreelancerList] = useState(false);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  // 비밀번호 변경
  const [showPwModal, setShowPwModal] = useState(false);
  // must_change_password가 명시적으로 false가 아니면 → 비밀번호 미변경자로 간주
  const needsPwChange = profile?.must_change_password !== false && profile?.role !== 'admin' && profile?.role !== 'editor';
  const [showPwBubble, setShowPwBubble] = useState(false);

  // 비밀번호 변경 필요시 말풍선 표시 (최초 1회)
  useEffect(() => {
    if (needsPwChange && typeof window !== 'undefined' && !sessionStorage.getItem('pw_bubble_dismissed')) {
      setShowPwBubble(true);
    }
  }, [needsPwChange]);

  // 현재 관리 페이지에 있으면 자동으로 열기
  useEffect(() => {
    const isOnAdminSub = adminSubItems.some(item => pathname.startsWith(item.href));
    if (isOnAdminSub) setManagementOpen(true);
  }, [pathname]);

  // 관리자일 때 프리랜서 + 직원 목록 로드 (한 번만)
  const listsFetched = useRef(false);
  useEffect(() => {
    if (!isAdmin || listsFetched.current) return;
    listsFetched.current = true;
    supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'freelancer')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setWriters(data || []));
    supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setEmployees(data || []));
  }, [isAdmin]);

  const handleViewAs = (id: string, role: 'freelancer' | 'employee', redirectTo: string) => {
    setViewAs(id, role);
    setShowFreelancerList(false);
    setShowEmployeeList(false);
    setPreviewOpen(false);
    router.push(redirectTo);
    onClose?.();
  };

  const handleExitViewAs = () => {
    setViewAs(null);
    router.push('/admin/dashboard');
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
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* 미리보기 모드 배너 */}
      {isInViewMode && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              {viewAsRole === 'freelancer' ? '프리랜서' : '직원'} 미리보기
            </span>
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
        {(isFreelancer || (isInViewMode && viewAsRole === 'freelancer')) && freelancerExtraItems.map(renderMenuItem)}

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

          </>
        )}

        {/* 관리자: 미리보기 */}
        {isAdmin && !isInViewMode && (
          <div className="pt-3 mt-3 border-t border-gray-200">
            <button
              onClick={() => { setPreviewOpen(!previewOpen); setShowFreelancerList(false); setShowEmployeeList(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                previewOpen ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye size={18} />
              <span className="flex-1 text-left">미리보기</span>
              <ChevronDown size={14} className={`transition-transform ${previewOpen ? 'rotate-180' : ''}`} />
            </button>

            {previewOpen && (
              <div className="ml-4 pl-3 border-l-2 border-gray-100 space-y-0.5 mt-1">
                {/* 프리랜서 미리보기 */}
                <button
                  onClick={() => { setShowFreelancerList(!showFreelancerList); setShowEmployeeList(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    showFreelancerList ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Briefcase size={15} />
                  프리랜서 미리보기
                </button>
                {showFreelancerList && (
                  <div className="ml-2 max-h-32 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200">
                    {writers.map(w => (
                      <button
                        key={w.id}
                        onClick={() => handleViewAs(w.id, 'freelancer', '/my')}
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

                {/* 직원용 미리보기 */}
                <button
                  onClick={() => { setShowEmployeeList(!showEmployeeList); setShowFreelancerList(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    showEmployeeList ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Users size={15} />
                  직원용 미리보기
                </button>
                {showEmployeeList && (
                  <div className="ml-2 max-h-32 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200">
                    {employees.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleViewAs(e.id, 'employee', '/notices')}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-gray-100 last:border-0"
                      >
                        {e.name}
                      </button>
                    ))}
                    {employees.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-400">등록된 직원이 없습니다.</p>
                    )}
                  </div>
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
          <div className="flex items-center gap-1 relative">
            {/* 비밀번호 변경 알림 말풍선 */}
            {showPwBubble && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-amber-50 border border-amber-200 rounded-lg p-2.5 shadow-lg z-50">
                <div className="flex items-start gap-2">
                  <KeyRound size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">비밀번호를 변경해주세요!</p>
                </div>
                <button
                  onClick={() => { setShowPwBubble(false); sessionStorage.setItem('pw_bubble_dismissed', 'true'); }}
                  className="absolute top-1 right-1 p-0.5 text-amber-300 hover:text-amber-500"
                >
                  <X size={12} />
                </button>
                <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-amber-50 border-r border-b border-amber-200 transform rotate-45" />
              </div>
            )}
            <button
              onClick={() => setShowPwModal(true)}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                needsPwChange ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="비밀번호 변경"
            >
              <KeyRound size={18} />
            </button>
            <button
              onClick={signOut}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPwModal && (
        <PasswordChangeModal
          onClose={() => setShowPwModal(false)}
          onSuccess={() => { setShowPwModal(false); setShowPwBubble(false); }}
        />
      )}
    </aside>
  );
}

