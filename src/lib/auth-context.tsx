'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from './supabase';
import type { User as AppUser } from '@/types/database';
import type { User as SupabaseUser } from '@supabase/supabase-js';

type ViewAsRole = 'freelancer' | 'employee' | null;

interface AuthContextType {
  user: SupabaseUser | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isEditor: boolean;
  isEmployee: boolean;
  refreshProfile: () => Promise<void>;
  // 미리보기 모드
  viewAsId: string | null;
  viewAsProfile: AppUser | null;
  viewAsRole: ViewAsRole;
  setViewAs: (id: string | null, role?: ViewAsRole) => void;
  isViewingAs: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewAsId, setViewAsIdState] = useState<string | null>(null);
  const [viewAsProfile, setViewAsProfile] = useState<AppUser | null>(null);
  const [viewAsRole, setViewAsRole] = useState<ViewAsRole>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // viewAs 프로필 로드
  useEffect(() => {
    if (!viewAsId) {
      setViewAsProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', viewAsId)
      .single()
      .then(({ data }) => setViewAsProfile(data));
  }, [viewAsId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    setViewAsIdState(null);
    setViewAsRole(null);
    setViewAsProfile(null);
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const setViewAs = useCallback((id: string | null, role: ViewAsRole = null) => {
    if (profile?.role !== 'admin' && profile?.role !== 'editor') return;
    setViewAsIdState(id);
    setViewAsRole(id ? role : null);
  }, [profile?.role]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.role === 'admin' || profile?.role === 'editor',
    isEditor: profile?.role === 'editor',
    isEmployee: profile?.role === 'employee',
    refreshProfile,
    viewAsId,
    viewAsProfile,
    viewAsRole,
    setViewAs,
    isViewingAs: !!viewAsId,
  }), [user, profile, loading, signIn, signOut, refreshProfile, viewAsId, viewAsProfile, viewAsRole, setViewAs]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
