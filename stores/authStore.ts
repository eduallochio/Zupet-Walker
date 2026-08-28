import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { WalkerProfile } from '../types/walker';

type AuthStore = {
  session: Session | null;
  user: User | null;
  walkerProfile: WalkerProfile | null;
  isTutor: boolean;
  loading: boolean;
  profileLoading: boolean;
  setSession: (session: Session | null) => void;
  setWalkerProfile: (profile: WalkerProfile | null) => void;
  forceReady: () => void;
  signOut: () => Promise<void>;
  fetchWalkerProfile: (userId?: string) => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  walkerProfile: null,
  isTutor: false,
  loading: true,
  profileLoading: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  forceReady: () => set({ loading: false, profileLoading: false }),

  setWalkerProfile: (walkerProfile) => set({ walkerProfile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, walkerProfile: null, isTutor: false });
  },

  fetchWalkerProfile: async (userId?: string) => {
    const uid = userId ?? get().user?.id;
    if (!uid) { set({ profileLoading: false }); return; }
    set({ profileLoading: true });
    try {
      const [walkerRes, tutorRes] = await Promise.all([
        supabase.from('walker_profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('user_profiles').select('id').eq('user_id', uid).maybeSingle(),
      ]);
      const { data } = walkerRes;
      set({ isTutor: !!tutorRes.data });

      if (data && !data.avatar_url) {
        const socialAvatar =
          get().session?.user?.user_metadata?.avatar_url ??
          get().session?.user?.user_metadata?.picture ??
          null;
        if (socialAvatar) {
          data.avatar_url = socialAvatar;
          supabase
            .from('walker_profiles')
            .update({ avatar_url: socialAvatar })
            .eq('user_id', uid)
            .then(() => {});
        }
      }

      // Calcular média real das avaliações dos tutores
      if (data?.id) {
        const { data: ratingsData } = await supabase
          .from('walker_ratings')
          .select('rating')
          .eq('walker_id', data.id);

        if (ratingsData && ratingsData.length > 0) {
          const avg = ratingsData.reduce((s: number, r: any) => s + Number(r.rating), 0) / ratingsData.length;
          data.rating = Math.round(avg * 10) / 10;
          // Persistir a média no perfil para ser exibida também no app do tutor
          supabase
            .from('walker_profiles')
            .update({ rating: data.rating })
            .eq('id', data.id)
            .then(() => {});
        }
      }

      set({ walkerProfile: data ?? null, profileLoading: false });
    } catch {
      set({ walkerProfile: null, profileLoading: false });
    }
  },
}));
