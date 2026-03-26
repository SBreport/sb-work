'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

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

    // 서버에서 별칭 해석 + 이름/이메일 검증을 모두 처리
    let email: string;
    try {
      const verifyRes = await fetch('/api/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), id: id.trim() }),
      });

      const data = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(data.error || '이름 또는 이메일이 올바르지 않습니다.');
        setLoading(false);
        return;
      }
      email = data.email;
    } catch {
      setError('서버 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    // Supabase Auth 로그인
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
            <label htmlFor="login-name" className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              id="login-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => { setName(e.target.value); e.target.setCustomValidity(''); }}
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('이름을 입력해주세요.')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="홍길동"
              required
            />
          </div>

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              id="login-email"
              name="email"
              type="text"
              autoComplete="email"
              value={id}
              onChange={(e) => { setId(e.target.value); e.target.setCustomValidity(''); }}
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('이메일 또는 아이디를 입력해주세요.')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="이메일 또는 아이디"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); e.target.setCustomValidity(''); }}
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('비밀번호를 입력해주세요.')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="비밀번호 입력"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm" role="alert">{error}</p>
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
