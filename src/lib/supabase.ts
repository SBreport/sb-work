import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 0 } },
  // WebSocket 연결을 아예 열지 않음
  global: { headers: {} },
});
