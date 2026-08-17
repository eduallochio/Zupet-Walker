import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { WalkerProfile } from '../types/walker';

type AuthStore = {
  session: Session | null;
  user: User | null;
  walkerProfile: WalkerProfile | null;
  loading: boolean;
  profileLoading: boolean;
  setSession: (session: Session | null) => void;
  setWalkerProfile: (profile: WalkerProfile | null) => void;
  signOut: () => Promise<void>;
  fetchWalkerProfile: (userId?: string) => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  walkerProfile: null,
  loading: true,
  profileLoading: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  setWalkerProfile: (walkerProfile) => set({ walkerProfile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, walkerProfile: null });
  },

  fetchWalkerProfile: async (userId?: string) => {
    const uid = userId ?? get().user?.id;
    if (!uid) { set({ profileLoading: false }); return; }
    set({ profileLoading: true });
    try {
      const { data } = await supabase
        .from('walker_profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      set({ walkerProfile: data ?? null, profileLoading: false });
    } catch {
      set({ walkerProfile: null, profileLoading: false });
    }
  },
}));
