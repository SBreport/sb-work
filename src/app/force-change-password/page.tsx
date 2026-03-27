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

  const handleSkip = () => {
    if (!canSkip || !user) return;

    // 즉시 이동 — 체감 속도 최우선
    sessionStorage.setItem('pw_skip_done', 'true');
    router.push('/');
    router.refresh();

    // skip_count 증가는 백그라운드로 (UI 블로킹 없음)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        fetch('/api/password-skip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
      }
    });
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

    // service_role API로 must_change_password 플래그 해제 (RLS 우회)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/complete-password-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) {
        setError('비밀번호는 변경되었으나 프로필 업데이트에 실패했습니다. 다시 로그인해주세요.');
        setLoading(false);
        return;
      }
    } catch {
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
      setLoading(false);
      return;
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
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-3">
              비밀번호 변경을 권장드려요
            </h1>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 text-left">
              <p className="text-sm text-amber-800 font-medium mb-2">
                잠깐! 변경 전에 알려드릴게요 :
              </p>
              <ul className="text-sm text-amber-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&#x2022;</span>
                  <span>초기 비밀번호는 다른 분도 알 수 있어, 변경하시면 더 안전해요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&#x2022;</span>
                  <span>나만의 비밀번호로 바꾸면 업무 정보를 안전하게 보호할 수 있어요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&#x2022;</span>
                  <span>건너뛰기는 <strong>{3 - skipCount}회</strong> 더 가능해요.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setStep('change')}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                지금 변경할게요
              </button>
              <button
                onClick={handleSkip}
                className="w-full py-2.5 border border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                다음에 변경할게요
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
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); e.target.setCustomValidity(''); }}
                  onInvalid={(e) => {
                    const input = e.target as HTMLInputElement;
                    if (input.validity.valueMissing) input.setCustomValidity('새 비밀번호를 입력해주세요.');
                    else if (input.validity.tooShort) input.setCustomValidity('비밀번호는 6자 이상이어야 합니다.');
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="6자 이상 입력"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); e.target.setCustomValidity(''); }}
                  onInvalid={(e) => {
                    const input = e.target as HTMLInputElement;
                    if (input.validity.valueMissing) input.setCustomValidity('비밀번호를 다시 입력해주세요.');
                    else if (input.validity.tooShort) input.setCustomValidity('비밀번호는 6자 이상이어야 합니다.');
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="다시 입력"
                  required
                  minLength={6}
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
