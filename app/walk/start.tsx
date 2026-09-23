import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { useWalkStore } from '../../stores/walkStore';
import { supabase } from '../../services/supabase';
import type { LinkedPet, ServiceType } from '../../types/walker';
import { maxPetsPerWalk } from '../../lib/plan';

type WalkPet = {
  pet_id: string;
  pet: { id: string; name: string; breed: string | null; photo_uri: string | null } | null;
  source: 'linked' | 'own';
};

export default function WalkStartScreen() {
  const router = useRouter();
  const { service_type: rawServiceType, schedule_id: scheduleId } = useLocalSearchParams<{ service_type?: string; schedule_id?: string }>();
  const serviceType = (rawServiceType as ServiceType) ?? 'walk';
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const startWalk = useWalkStore((s) => s.startWalk);
  const activeWalk = useWalkStore((s) => s.activeWalk);

  const [pets, setPets] = useState<WalkPet[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeWalk) {
      router.replace('/walk/active');
      return;
    }
    if (!walkerProfile) return;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [linkedRes, ownRes, mergedRes] = await Promise.all([
        supabase
          .from('walker_pet_links')
          .select('pet_id, pet:pets(id,name,breed,photo_uri)')
          .eq('walker_id', walkerProfile.id)
          .eq('status', 'active'),
        supabase
          .from('pets')
          .select('id,name,breed,photo_uri')
          .eq('walker_owner_id', user.id)
          .is('merged_into', null),
        // Pets do tutor que foram importados a partir de pets cadastrados por este walker
        supabase
          .from('pets')
          .select('merged_into')
          .eq('walker_owner_id', user.id)
          .not('merged_into', 'is', null),
      ]);

      const linked: WalkPet[] = (linkedRes.data ?? []).map((r: any) => ({
        pet_id: r.pet_id,
        pet: r.pet,
        source: 'linked' as const,
      }));

      const own: WalkPet[] = (ownRes.data ?? []).map((p: any) => ({
        pet_id: p.id,
        pet: { id: p.id, name: p.name, breed: p.breed, photo_uri: p.photo_uri },
        source: 'own' as const,
      }));

      // Buscar dados reais dos pets do tutor que vieram de merge
      const mergedIntoIds = (mergedRes.data ?? []).map((r: any) => r.merged_into).filter(Boolean);
      let mergedPets: WalkPet[] = [];
      if (mergedIntoIds.length > 0) {
        const { data: tutorPetsData } = await supabase
          .from('pets')
          .select('id,name,breed,photo_uri')
          .in('id', mergedIntoIds);
        mergedPets = (tutorPetsData ?? []).map((p: any) => ({
          pet_id: p.id,
          pet: { id: p.id, name: p.name, breed: p.breed, photo_uri: p.photo_uri },
          source: 'own' as const,
        }));
      }

      const linkedIds = new Set(linked.map((l) => l.pet_id));
      const uniqueOwn = own.filter((o) => !linkedIds.has(o.pet_id));
      const uniqueMerged = mergedPets.filter((m) => !linkedIds.has(m.pet_id));

      setPets([...linked, ...uniqueOwn, ...uniqueMerged]);
      setLoading(false);
    };

    load();
  }, [walkerProfile, activeWalk]);

  const SERVICE_LABELS: Record<ServiceType, string> = {
    walk: 'passeio',
    bath: 'banho e tosa',
    boarding: 'hospedagem',
    daycare: 'day care',
    training: 'adestramento',
    vet_visit: 'visita veterinária',
  };
  const serviceLabel = SERVICE_LABELS[serviceType] ?? 'atendimento';

  const toggle = (petId: string) => {
    const limit = maxPetsPerWalk(walkerProfile);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(petId)) {
        next.delete(petId);
      } else {
        if (next.size >= limit) {
          Alert.alert(
            `Limite de pets por ${serviceLabel}`,
            `Você configurou o máximo de ${limit} pet${limit !== 1 ? 's' : ''} por ${serviceLabel}.`,
            [{ text: 'Entendido' }]
          );
          return prev;
        }
        next.add(petId);
      }
      return next;
    });
  };

  const handleStart = () => {
    if (selected.size === 0) {
      Alert.alert('Selecione ao menos um pet', `Escolha os pets para este ${serviceLabel}.`);
      return;
    }
    if (!walkerProfile) return;
    startWalk(walkerProfile.id, Array.from(selected), scheduleId, serviceType);
    router.replace('/walk/active');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Iniciar {serviceLabel.charAt(0).toUpperCase() + serviceLabel.slice(1)}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.subtitle}>Selecione os pets para este {serviceLabel}</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : pets.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="paw-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>Nenhum pet vinculado</Text>
          <Text style={styles.emptyText}>Você precisa ter pets ativos vinculados para iniciar um {serviceLabel}.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {pets.map((item) => {
            const isSelected = selected.has(item.pet_id);
            return (
              <TouchableOpacity
                key={item.pet_id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggle(item.pet_id)}
                activeOpacity={0.75}
              >
                <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                  <Ionicons name="paw" size={22} color={isSelected ? '#fff' : Colors.primary} />
                </View>
                <View style={styles.petInfo}>
                  <View style={styles.petNameRow}>
                    <Text style={styles.petName}>{item.pet?.name ?? '—'}</Text>
                    {item.source === 'own' && (
                      <View style={styles.ownBadge}>
                        <Text style={styles.ownBadgeText}>Meu pet</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.petBreed}>{item.pet?.breed ?? 'Raça não informada'}</Text>
                </View>
                <View style={[styles.check, isSelected && styles.checkSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {pets.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.startBtn, selected.size === 0 && styles.startBtnDisabled]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.startBtnText}>
              Iniciar{selected.size > 0 ? ` com ${selected.size} pet${selected.size > 1 ? 's' : ''}` : ` ${serviceLabel}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: 20, marginBottom: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 20, gap: 10, paddingBottom: 20 },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownBadge: {
    backgroundColor: `${Colors.primary}20`, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  ownBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: 16,
    padding: 14, borderWidth: 2, borderColor: Colors.border,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: `${Colors.primary}18`, justifyContent: 'center', alignItems: 'center',
  },
  avatarSelected: { backgroundColor: Colors.primary },
  petInfo: { flex: 1 },
  petName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  petBreed: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  check: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  footer: { padding: 20, paddingTop: 12 },
  startBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  startBtnDisabled: { backgroundColor: Colors.border },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
