'use client';

import { useAuth } from '@/lib/auth-context';
import AppShell from './AppShell';
import { FullPageSpinner } from './Spinner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!user) return null; // AppShell handles redirect

  return <AppShell>{children}</AppShell>;
}
