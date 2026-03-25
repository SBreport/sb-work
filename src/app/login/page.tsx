'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

// 짧은 ID → 실제 이메일 매핑
const ID_ALIASES: Record<string, string> = {
  'admin': 'jogons.b@gmail.com',
};

function resolveEmail(input: string): string {
  const lower = input.trim().toLowerCase();
  // 별칭이 있으면 매핑된 이메일 반환
  if (ID_ALIASES[lower]) return ID_ALIASES[lower];
  // @가 없으면 @gmail.com 자동 추가
  if (!lower.includes('@')) return `${lower}@gmail.com`;
  return lower;
}

export default function LoginPage() {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = resolveEmail(id);

    // 1단계: 이름 + 이메일 매칭 검증 (관리자 별칭은 검증 스킵)
    if (!ID_ALIASES[id.trim().toLowerCase()]) {
      try {
        const verifyRes = await fetch('/api/verify-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email }),
        });

        if (!verifyRes.ok) {
          const data = await verifyRes.json();
          setError(data.error || '이름 또는 이메일이 올바르지 않습니다.');
          setLoading(false);
          return;
        }
      } catch {
        setError('서버 연결에 실패했습니다.');
        setLoading(false);
        return;
      }
    }

    // 2단계: Supabase Auth 로그인
    const { error } = await signIn(email, password);
    if (error) {
      setError('비밀번호가 올바르지 않습니다.');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">스마트브랜딩</h1>
          <p className="text-gray-500 mt-2">업무분장 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="홍길동"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="이메일 또는 아이디"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="초기 비밀번호: 010010"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
