'use client';

import { useEffect, useState, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Plus, Trash2, Save, GripVertical, Users, ChevronDown, ChevronRight } from 'lucide-react';

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

const POSITIONS = ['대표', '이사', '총괄팀장', '팀장', '팀원'];
const MENTOR_ROLES = [null, '사수', '부사수'] as const;

function TeamManager({
  team,
  allMembers,
  allTeams,
  onUpdate,
  onDelete,
  isAdmin,
}: {
  team: Team;
  allMembers: Member[];
  allTeams: Team[];
  onUpdate: () => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(team.name);
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    if (!name.trim() || name === team.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    await authFetch('/api/organization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'team', id: team.id, name: name.trim() }),
    });
    setSaving(false);
    setEditingName(false);
    onUpdate();
  };

  const updateActingLeader = async (leaderId: string | null) => {
    await authFetch('/api/organization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'team', id: team.id, acting_leader_id: leaderId }),
    });
    onUpdate();
  };

  const updateMember = async (memberId: string, updates: Record<string, unknown>) => {
    await authFetch('/api/organization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'member', id: memberId, ...updates }),
    });
    onUpdate();
  };

  const isVirtualTeam = team.id === '__executives' || team.id === '__unassigned';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* 팀 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button onClick={() => setOpen(!open)} className="p-1">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {!isVirtualTeam && editingName && isAdmin ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              onBlur={saveName}
              autoFocus
              className="px-2 py-1 border border-blue-300 rounded text-sm font-bold flex-1 max-w-xs"
            />
            <button onClick={saveName} disabled={saving} className="text-blue-600 hover:text-blue-800">
              <Save size={14} />
            </button>
          </div>
        ) : (
          <h3
            className={`text-sm font-bold text-gray-900 flex-1 ${!isVirtualTeam && isAdmin ? 'cursor-pointer hover:text-blue-600' : ''}`}
            onClick={() => !isVirtualTeam && isAdmin && setEditingName(true)}
          >
            {team.name}
          </h3>
        )}

        <span className="text-xs text-gray-400">{team.members.length}명</span>

        {!isVirtualTeam && isAdmin && (
          <button
            onClick={() => {
              if (confirm(`"${team.name}" 팀을 삭제하시겠습니까? 소속 멤버는 미소속으로 변경됩니다.`)) {
                onDelete(team.id);
              }
            }}
            className="p-1 text-gray-400 hover:text-red-500"
            title="팀 삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="divide-y divide-gray-100">
          {/* 직무대행자 설정 */}
          {!isVirtualTeam && isAdmin && (
            <div className="px-4 py-2 bg-yellow-50 flex items-center gap-2 text-xs">
              <span className="text-yellow-700 font-medium">직무대행:</span>
              <select
                value={team.acting_leader_id || ''}
                onChange={e => updateActingLeader(e.target.value || null)}
                className="border border-yellow-300 rounded px-2 py-1 text-xs bg-white"
              >
                <option value="">없음</option>
                {allMembers
                  .filter(m => ['admin', 'editor', 'employee'].includes(m.role))
                  .map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
              </select>
            </div>
          )}

          {team.members.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">소속 멤버가 없습니다.</p>
          ) : (
            team.members.map(member => (
              <div key={member.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50">
                <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 w-20 flex-shrink-0">{member.name}</span>

                {isAdmin ? (
                  <>
                    {/* 팀 */}
                    <select
                      value={member.team_id || ''}
                      onChange={e => updateMember(member.id, { team_id: e.target.value || null })}
                      className="border border-gray-200 rounded px-1.5 py-1 text-xs w-24"
                    >
                      <option value="">미소속</option>
                      {allTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>

                    {/* 직위 */}
                    <select
                      value={member.position || ''}
                      onChange={e => updateMember(member.id, { position: e.target.value || null })}
                      className="border border-gray-200 rounded px-1.5 py-1 text-xs w-20"
                    >
                      <option value="">직위 없음</option>
                      {POSITIONS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    {/* 멘토 역할 */}
                    <select
                      value={member.mentor_role ?? ''}
                      onChange={e => updateMember(member.id, { mentor_role: e.target.value === '' ? null : e.target.value })}
                      className="border border-gray-200 rounded px-1.5 py-1 text-xs w-16"
                    >
                      {MENTOR_ROLES.map(r => (
                        <option key={r ?? 'none'} value={r ?? ''}>{r ?? '없음'}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {member.position && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {member.position}
                      </span>
                    )}
                    {member.mentor_role && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        {member.mentor_role}
                      </span>
                    )}
                  </div>
                )}

                <span className={`text-xs ml-auto ${member.is_active ? 'text-green-500' : 'text-gray-400'}`}>
                  {member.employee_type === 'partner' ? '협력사' : member.is_active ? '재직' : '퇴직'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminOrganizationPage() {
  const { profile } = useAuth();
  const isAdminOnly = profile?.role === 'admin';
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    authFetch('/api/organization')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allMembers = data
    ? [...data.unassigned, ...data.teams.flatMap(t => t.members)]
    : [];

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    const maxOrder = data?.teams.reduce((max, t) => Math.max(max, t.sort_order), 0) ?? 0;
    await authFetch('/api/organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTeamName.trim(), sort_order: maxOrder + 1 }),
    });
    setNewTeamName('');
    setCreating(false);
    fetchData();
  };

  const deleteTeam = async (id: string) => {
    await authFetch(`/api/organization?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  if (loading && !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <h2 className="text-xl font-bold text-gray-900">조직도 관리</h2>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">조직도 관리</h2>
        <a
          href="/organization"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          열람 페이지 보기 →
        </a>
      </div>

      {/* 팀 추가 */}
      {isAdminOnly && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <Users size={18} className="text-blue-600 flex-shrink-0" />
          <input
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTeam()}
            placeholder="새 팀 이름..."
            className="flex-1 px-3 py-1.5 border border-blue-200 rounded text-sm bg-white"
          />
          <button
            onClick={createTeam}
            disabled={creating || !newTeamName.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            추가
          </button>
        </div>
      )}

      {/* 경영진 (미소속) */}
      {data && data.unassigned.length > 0 && (
        <TeamManager
          team={{
            id: '__executives',
            name: '경영진 (팀 미소속)',
            sort_order: -1,
            acting_leader_id: null,
            acting_leader_name: null,
            members: data.unassigned,
          }}
          allMembers={allMembers}
          allTeams={data?.teams || []}
          onUpdate={fetchData}
          onDelete={() => {}}
          isAdmin={isAdminOnly}
        />
      )}

      {/* 팀 목록 */}
      {data?.teams.map(team => (
        <TeamManager
          key={team.id}
          team={team}
          allMembers={allMembers}
          allTeams={data?.teams || []}
          onUpdate={fetchData}
          onDelete={deleteTeam}
          isAdmin={isAdminOnly}
        />
      ))}

      {data && data.teams.length === 0 && data.unassigned.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>등록된 조직 정보가 없습니다.</p>
          <p className="text-sm mt-1">위에서 팀을 추가하세요.</p>
        </div>
      )}
    </div>
  );
}
