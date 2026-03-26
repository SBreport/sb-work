'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { AlertTriangle } from 'lucide-react';

type Step = 'welcome' | 'change' | 'skip-warning';

export default function ForceChangePasswordPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  // 비로그인 사용자는 로그인 페이지로
  if (!user) {
    router.push('/login');
    return null;
  }

  // 이미 비밀번호 변경 완료된 유저는 홈으로
  if (profile && !profile.must_change_password) {
    router.push('/');
    return null;
  }

  const skipCount = profile?.password_skip_count || 0;
  const canSkip = skipCount < 3;

  const handleSkip = async () => {
    if (!canSkip || !user) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/password-skip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      // sessionStorage에 스킵 표시 → 이번 세션에서 다시 안내 안 보여줌
      sessionStorage.setItem('pw_skip_done', 'true');
      await refreshProfile();
      router.push('/');
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (authError) {
      setError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    if (user) {
      await supabase
        .from('profiles')
        .update({ must_change_password: false, password_skip_count: 0 })
        .eq('id', user.id);
    }

    await refreshProfile();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">

        {/* Step 1: 환영 안내 */}
        {step === 'welcome' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              환영합니다, {profile?.name || '담당자'}님!
            </h1>
            <p className="text-sm text-gray-500 mb-2">
              로그인에 성공했습니다.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              보안을 위해 <span className="font-semibold text-amber-600">비밀번호를 변경</span>해주세요.
              <br />
              변경 후 안전하게 서비스를 이용하실 수 있습니다.
            </p>

            <button
              onClick={() => setStep('change')}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors mb-3"
            >
              비밀번호 변경하기
            </button>

            {canSkip && (
              <button
                onClick={() => setStep('skip-warning')}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                나중에 변경 ({3 - skipCount}회 남음)
              </button>
            )}

            {!canSkip && (
              <p className="text-xs text-red-500 mt-2">
                건너뛰기 횟수를 모두 사용했습니다. 비밀번호를 변경해야 이용 가능합니다.
              </p>
            )}
          </div>
        )}

        {/* 건너뛰기 경고 */}
        {step === 'skip-warning' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-3">
              정말 건너뛰시겠습니까?
            </h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5 text-left">
              <p className="text-sm text-red-800 font-medium mb-2">
                비밀번호를 변경하지 않으면:
              </p>
              <ul className="text-sm text-red-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#x2022;</span>
                  <span>초기 비밀번호를 아는 누구나 귀하의 계정에 접근할 수 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#x2022;</span>
                  <span>귀하의 업무 정보가 다른 사람에게 노출될 위험이 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#x2022;</span>
                  <span>건너뛰기는 <strong>{3 - skipCount}회</strong>만 가능하며, 이후 강제 변경됩니다.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setStep('change')}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                지금 비밀번호 변경하기
              </button>
              <button
                onClick={handleSkip}
                className="w-full py-2.5 border border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                위험을 이해했습니다. 나중에 변경하겠습니다.
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 비밀번호 변경 폼 */}
        {step === 'change' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">새 비밀번호 설정</h1>
              <p className="text-sm text-gray-500 mt-2">
                앞으로 로그인할 때 사용할 비밀번호를 입력해주세요.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="6자 이상 입력"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="다시 입력"
                  required
                  minLength={6}
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
                {loading ? '변경 중...' : '비밀번호 변경 완료'}
              </button>

              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                이전으로
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
