'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Phone, Mail, X, ChevronDown } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  position?: string;
  mentor_role?: string;
  sort_order: number;
  team_id: string | null;
  employee_type: string;
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  sort_order: number;
  acting_leader_id: string | null;
  acting_leader_name: string | null;
  members: Member[];
}

interface OrgData {
  teams: Team[];
  unassigned: Member[];
}

/* ── 연락처 모달 ── */
function ContactModal({ member, onClose }: { member: Member; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar position={member.position} mentorRole={member.mentor_role} size="lg" />
            <div>
              <h3 className="font-bold text-gray-900">{member.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {member.position && <span className="text-xs text-gray-500">{member.position}</span>}
                {member.mentor_role && <span className="text-xs text-gray-400">· {member.mentor_role}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="space-y-2.5">
          {member.phone && (
            <a href={`tel:${member.phone}`} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
              <Phone size={14} className="text-gray-400" />
              <span className="text-sm text-gray-700">{member.phone}</span>
            </a>
          )}
          {member.email && (
            <a href={`mailto:${member.email}`} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
              <Mail size={14} className="text-gray-400" />
              <span className="text-sm text-gray-700 truncate">{member.email}</span>
            </a>
          )}
          {!member.phone && !member.email && (
            <p className="text-sm text-gray-400 text-center py-2">연락처 정보가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 직책 아바타 ── */
function Avatar({ position, mentorRole, size = 'sm', isMe = false }: { position?: string; mentorRole?: string; size?: 'sm' | 'lg'; isMe?: boolean }) {
  const label = mentorRole || position || '';
  const config: Record<string, { abbr: string; bg: string; text: string }> = {
    '대표': { abbr: '대표', bg: 'bg-blue-700', text: 'text-white' },
    '이사': { abbr: '이사', bg: 'bg-blue-600', text: 'text-white' },
    '총괄팀장': { abbr: '총괄', bg: 'bg-indigo-600', text: 'text-white' },
    '팀장': { abbr: '팀장', bg: 'bg-sky-600', text: 'text-white' },
    '사수': { abbr: '사수', bg: 'bg-emerald-600', text: 'text-white' },
    '부사수': { abbr: '부사', bg: 'bg-amber-500', text: 'text-white' },
    '팀원': { abbr: '팀원', bg: 'bg-gray-200', text: 'text-gray-600' },
  };
  const c = config[label] || { abbr: label?.slice(0, 2) || '·', bg: 'bg-gray-200', text: 'text-gray-500' };
  const sizeClass = size === 'lg' ? 'w-10 h-10 text-xs' : 'w-7 h-7 text-[10px]';
  const shimmer = isMe && position === '팀장' ? 'avatar-shimmer' : '';

  return (
    <div className={`${sizeClass} rounded-full ${c.bg} ${c.text} flex items-center justify-center font-bold shrink-0 relative overflow-hidden ${shimmer}`}>
      {c.abbr}
    </div>
  );
}

/* ── 개인 행 ── */
function PersonRow({ member, onClick, isMe = false }: { member: Member; onClick: () => void; isMe?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors text-left group"
    >
      <Avatar position={member.position} mentorRole={member.mentor_role} isMe={isMe} />
      <span className="text-sm text-gray-900 font-medium flex-1 min-w-0 truncate">{member.name}</span>
      <Phone size={11} className="text-gray-200 group-hover:text-blue-400 shrink-0 transition-colors" />
    </button>
  );
}

/* ── 임원 헤더 (이름 + 직책, 클릭 가능) ── */
function ExecutiveHeader({ member, onClick }: { member: Member; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left w-full group"
    >
      <Avatar position={member.position} mentorRole={member.mentor_role} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-gray-900">{member.name}</div>
        <div className="text-xs text-gray-500">{member.position}</div>
      </div>
      <Phone size={14} className="text-gray-200 group-hover:text-blue-400 shrink-0 transition-colors" />
    </button>
  );
}

/* ── 팀 카드 (접힘/열림) ── */
function TeamCard({ team, onMemberClick, defaultOpen = true, myId }: { team: Team; onMemberClick: (m: Member) => void; defaultOpen?: boolean; myId?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const leader = team.members.find(m => m.position === '팀장');
  const mentors = team.members.filter(m => m.mentor_role === '사수');
  const mentees = team.members.filter(m => m.mentor_role === '부사수');
  const others = team.members.filter(m => m.position !== '팀장' && !m.mentor_role);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* 팀 헤더 — 클릭으로 접힘/열림 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 bg-blue-600 hover:bg-blue-700 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-white">{team.name}</h4>
          {leader
            ? <span className="text-[10px] text-blue-200">· 팀장 {leader.name}</span>
            : team.acting_leader_name && <span className="text-[10px] text-blue-200">· 총괄 {team.acting_leader_name}</span>
          }
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-200">{team.members.length}명</span>
          <ChevronDown size={14} className={`text-blue-200 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* 멤버 목록 */}
      {open && (
        <div className="p-1.5">
          {leader && (
            <div className="mb-1 pb-1 border-b border-gray-100">
              <PersonRow member={leader} onClick={() => onMemberClick(leader)} isMe={leader.id === myId} />
            </div>
          )}

          {mentors.length > 0 && (
            <div className="mb-1">
              <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold text-emerald-600 tracking-wider">사수 {mentors.length}</div>
              <div className="grid grid-cols-2 gap-x-1">
                {mentors.map(m => <PersonRow key={m.id} member={m} onClick={() => onMemberClick(m)} isMe={m.id === myId} />)}
              </div>
            </div>
          )}

          {mentees.length > 0 && (
            <div className="mb-1">
              <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold text-amber-600 tracking-wider">부사수 {mentees.length}</div>
              <div className="grid grid-cols-2 gap-x-1">
                {mentees.map(m => <PersonRow key={m.id} member={m} onClick={() => onMemberClick(m)} isMe={m.id === myId} />)}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              {(leader || mentors.length > 0 || mentees.length > 0) && (
                <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold text-gray-400 tracking-wider">팀원 {others.length}</div>
              )}
              {others.map(m => <PersonRow key={m.id} member={m} onClick={() => onMemberClick(m)} isMe={m.id === myId} />)}
            </div>
          )}

          {team.members.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">소속 멤버 없음</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function OrganizationPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const myId = profile?.id;

  useEffect(() => {
    authFetch('/api/organization')
      .then(res => {
        if (!res.ok) throw new Error('조직도 데이터를 불러올 수 없습니다.');
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">조직도</h2>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">조직도</h2>
        <div className="text-center py-12 text-gray-500">
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">다시 시도</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const exec = data.unassigned;
  const onClick = (m: Member) => setSelectedMember(m);

  // 경영진 찾기
  const ceo = exec.find(m => m.position === '대표');
  const director = exec.find(m => m.position === '이사');
  const gm = exec.find(m => m.position === '총괄팀장');

  // 팀 찾기
  const teamByName = (name: string) => data.teams.find(t => t.name === name);
  const bizSupport = teamByName('경영지원');
  // 2열: 블로그팀 + 브랜딩팀 (총괄팀장 아래)
  const col2Teams = ['블로그팀', '브랜딩팀']
    .map(n => teamByName(n))
    .filter(Boolean) as Team[];
  // 3열: 상위노출팀 + 바이럴팀
  const col3Teams = ['상위노출팀', '바이럴팀']
    .map(n => teamByName(n))
    .filter(Boolean) as Team[];
  const otherTeams = data.teams.filter(t =>
    !['블로그팀', '바이럴팀', '상위노출팀', '브랜딩팀', '경영지원'].includes(t.name)
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-6">조직도</h2>

      {/* ── 대표 ── */}
      {ceo && (
        <div className="mb-6">
          <ExecutiveHeader member={ceo} onClick={() => onClick(ceo)} />
        </div>
      )}

      {/* ── 이사 | 블로그팀 | 그 외 팀 — PC: 3열, 태블릿: 2열, 모바일: 1열 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {/* 1열: 이사 → 경영지원 */}
        {director && (
          <div className="pl-4 border-l-2 border-blue-200">
            <ExecutiveHeader member={director} onClick={() => onClick(director)} />
            {bizSupport && (
              <div className="mt-3">
                <TeamCard team={bizSupport} onMemberClick={onClick} myId={myId} />
              </div>
            )}
          </div>
        )}

        {/* 2열: 총괄팀장 → 블로그팀 + 브랜딩팀 */}
        {gm && (
          <div className="pl-4 border-l-2 border-indigo-200">
            <ExecutiveHeader member={gm} onClick={() => onClick(gm)} />
            <div className="mt-3 space-y-3">
              {col2Teams.map(team => (
                <TeamCard key={team.id} team={team} onMemberClick={onClick} myId={myId} />
              ))}
            </div>
          </div>
        )}

        {/* 3열: 상위노출팀 + 바이럴팀 */}
        {col3Teams.length > 0 && gm && (
          <div className="pl-4 border-l-2 border-indigo-200 md:col-start-2 lg:col-start-3">
            {/* PC: 투명 헤더로 높이 맞춤 */}
            <div className="hidden lg:block mb-3 invisible pointer-events-none" aria-hidden="true">
              <ExecutiveHeader member={gm} onClick={() => {}} />
            </div>
            <div className="space-y-3">
              {col3Teams.map(team => (
                <TeamCard key={team.id} team={team} onMemberClick={onClick} myId={myId} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 기타 팀 (있으면) */}
      {otherTeams.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">기타</h3>
          <div className="space-y-3">
            {otherTeams.map(team => (
              <TeamCard key={team.id} team={team} onMemberClick={onClick} myId={myId} />
            ))}
          </div>
        </div>
      )}

      {/* 연락처 모달 */}
      {selectedMember && (
        <ContactModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
}
