import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { useWalkStore } from '../../stores/walkStore';
import { supabase } from '../../services/supabase';
import { TodaySchedule } from '../../components/home/TodaySchedule';
import type { LinkedPet } from '../../types/walker';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const activeWalk    = useWalkStore((s) => s.activeWalk);
  const firstName     = walkerProfile?.name?.split(' ')[0] ?? 'Walker';

  const [pets, setPets] = useState<LinkedPet[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      setUnreadCount(count ?? 0);
    })();
  }, []));

  useEffect(() => {
    if (!walkerProfile) return;
    (async () => {
      const [petsRes, sessionsRes] = await Promise.all([
        supabase
          .from('walker_pet_links')
          .select('id, walker_id, pet_id, owner_id, status, linked_at, pet:pets(id,name,breed,photo_uri)')
          .eq('walker_id', walkerProfile.id)
          .eq('status', 'active'),
        supabase
          .from('walk_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('walker_id', walkerProfile.id),
      ]);
      if (__DEV__ && petsRes.error) console.warn('[HomeScreen] pets query error:', petsRes.error);
      const rows = (petsRes.data as any[]) ?? [];
      const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
      let ownersMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('user_profiles')
          .select('user_id, name, avatar_url')
          .in('user_id', ownerIds);
        if (owners) owners.forEach((o: any) => { ownersMap[o.user_id] = o; });
      }
      setPets(rows.map((r) => ({ ...r, owner: ownersMap[r.owner_id] ?? null })) as LinkedPet[]);
      setTotalSessions(sessionsRes.count ?? 0);
      setLoading(false);
    })();
  }, [walkerProfile]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}! 👋</Text>
            <Text style={styles.greetingSub}>
              {pets.length > 0
                ? `${pets.length} pet${pets.length > 1 ? 's' : ''} vinculado${pets.length > 1 ? 's' : ''}`
                : 'Nenhum pet vinculado ainda'}
            </Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications' as any)}>
            <Ionicons name="notifications-outline" size={24} color={Colors.text} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Banner passeio */}
        <TouchableOpacity
          style={[styles.startBanner, activeWalk && styles.startBannerActive]}
          onPress={() => router.push(activeWalk ? '/walk/active' : '/walk/start')}
          activeOpacity={0.85}
        >
          <View style={styles.startBannerLeft}>
            <Text style={styles.startBannerTitle}>
              {activeWalk ? 'Passeio em andamento' : 'Iniciar Passeio'}
            </Text>
            <Text style={styles.startBannerSub}>
              {activeWalk ? 'Toque para voltar' : 'Toque para começar agora'}
            </Text>
          </View>
          <View style={styles.startBannerBtn}>
            <Ionicons name={activeWalk ? 'radio-button-on' : 'play'} size={22} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pets.length}</Text>
            <Text style={styles.statLabel}>Pets ativos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Passeios</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{walkerProfile?.rating?.toFixed(1) ?? '—'}</Text>
            <Text style={styles.statLabel}>Avaliação</Text>
          </View>
        </View>

        {/* Agenda de hoje */}
        <TodaySchedule />

        {/* Pets vinculados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PETS VINCULADOS {pets.length > 0 ? `(${pets.length})` : ''}</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          ) : pets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="paw-outline" size={32} color={Colors.border} />
              <Text style={styles.emptyText}>Nenhum pet vinculado ainda</Text>
              <Text style={styles.emptySubText}>Quando um tutor vincular um pet, ele aparecerá aqui</Text>
            </View>
          ) : (
            <View style={styles.petList}>
              {pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id} style={styles.petRow} activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/pets')}
                >
                  <View style={styles.petAvatar}>
                    <Ionicons name="paw" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{pet.pet?.name ?? '—'}</Text>
                    <Text style={styles.petBreed}>
                      {pet.pet?.breed ?? 'Raça não informada'} · {pet.owner?.name ?? '—'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 32, gap: 20 },
  header: { paddingHorizontal: 20, paddingTop: 20, flexDirection: 'row', alignItems: 'center' },
  bellBtn: { padding: 4, position: 'relative' },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 17, height: 17,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.text },
  greetingSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  startBanner: {
    marginHorizontal: 20, backgroundColor: Colors.primary,
    borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  startBannerActive: { backgroundColor: Colors.primaryDark },
  startBannerLeft: { gap: 3 },
  startBannerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  startBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  startBannerBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 28, alignItems: 'center', gap: 8,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  emptySubText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  petList: { backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  petRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  petAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: `${Colors.primary}18`, justifyContent: 'center', alignItems: 'center',
  },
  petInfo: { flex: 1 },
  petName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  petBreed: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
});
