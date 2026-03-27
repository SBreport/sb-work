'use client';

import { useAuth } from '@/lib/auth-context';
import AppShell from './AppShell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // AppShell already handles redirect to /login
  if (loading || !user) return null;

  return <AppShell>{children}</AppShell>;
}
