import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

type WalkReport = {
  id: string;
  session_id: string | null;
  duration_minutes: number | null;
  distance_meters: number | null;
  pee_count: number;
  poop_count: number;
  note_count: number;
  notes: string | null;
  photos: string[];
  sent_at: string;
  pet_ids: string[] | null;
  owner_name?: string;
  owner_id: string;
};

type LinkedPet = { id: string; name: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function HistoricoScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [reports, setReports]         = useState<WalkReport[]>([]);
  const [pets, setPets]               = useState<LinkedPet[]>([]);
  const [petNamesMap, setPetNamesMap] = useState<Record<string, string>>({});
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const fetchData = useCallback(async () => {
    if (!walkerProfile) return;

    const reportsRes = await supabase
      .from('walk_reports')
      .select('id, session_id, duration_minutes, distance_meters, pee_count, poop_count, note_count, notes, photos, sent_at, pet_ids, owner_id')
      .eq('walker_id', walkerProfile.id)
      .order('sent_at', { ascending: false });

    const raw = (reportsRes.data ?? []) as WalkReport[];

    // Coletar todos os pet_ids únicos de todos os reports
    const allPetIds = [...new Set(raw.flatMap((r) => r.pet_ids ?? []))];

    // Buscar nomes direto da tabela pets (não só os ativos)
    let petList: LinkedPet[] = [];
    let namesMap: Record<string, string> = {};
    if (allPetIds.length > 0) {
      const { data: petsData } = await supabase
        .from('pets')
        .select('id, name')
        .in('id', allPetIds);
      (petsData ?? []).forEach((p: any) => { namesMap[p.id] = p.name; });
      petList = (petsData ?? []).map((p: any) => ({ id: p.id, name: p.name }));
    }
    setPets(petList);
    setPetNamesMap(namesMap);

    // Nomes dos tutores
    const ownerIds = [...new Set(raw.map((r) => r.owner_id))];
    let ownerNamesMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from('user_profiles').select('user_id,name').in('user_id', ownerIds);
      (owners ?? []).forEach((o: any) => { ownerNamesMap[o.user_id] = o.name; });
    }

    setReports(raw.map((r) => ({ ...r, owner_name: ownerNamesMap[r.owner_id] ?? '—' })));
  }, [walkerProfile]);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  // Filtro por pet
  const filtered = useMemo(() =>
    selectedPet
      ? reports.filter((r) => r.pet_ids?.includes(selectedPet))
      : reports,
    [reports, selectedPet]
  );

  // Totais do filtro atual
  const totalMinutes  = filtered.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
  const totalDistance = filtered.reduce((s, r) => s + (r.distance_meters ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Totais */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="paw-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{filtered.length}</Text>
            <Text style={styles.statLabel}>passeios</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{formatDuration(totalMinutes)}</Text>
            <Text style={styles.statLabel}>no total</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="location-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{(totalDistance / 1000).toFixed(1)} km</Text>
            <Text style={styles.statLabel}>percorridos</Text>
          </View>
        </View>

        {/* Filtro por pet */}
        {pets.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[styles.filterChip, selectedPet === null && styles.filterChipActive]}
              onPress={() => setSelectedPet(null)}
            >
              <Text style={[styles.filterChipText, selectedPet === null && styles.filterChipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[styles.filterChip, selectedPet === pet.id && styles.filterChipActive]}
                onPress={() => setSelectedPet(selectedPet === pet.id ? null : pet.id)}
              >
                <Text style={[styles.filterChipText, selectedPet === pet.id && styles.filterChipTextActive]}>
                  {pet.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="paw-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>
              {selectedPet ? 'Nenhum passeio com este pet' : 'Nenhum passeio ainda'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedPet
                ? 'Nenhum passeio registrado para este pet. Tente outro filtro.'
                : 'Quando você finalizar um passeio, ele aparecerá aqui.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((report) => (
              <TouchableOpacity
                key={report.id}
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => router.push(`/walk-report-detail?id=${report.id}` as any)}
              >
                {/* Topo */}
                <View style={styles.cardTop}>
                  <View style={styles.cardAvatar}>
                    <Ionicons name="person-outline" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardOwner}>{report.owner_name}</Text>
                    <Text style={styles.cardDate}>{formatDate(report.sent_at)}</Text>
                  </View>
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.completedText}>Concluído</Text>
                  </View>
                </View>

                {/* Pets do passeio */}
                {(report.pet_ids?.length ?? 0) > 0 && (
                  <View style={styles.petsRow}>
                    {(report.pet_ids ?? []).map((pid) => (
                      <View key={pid} style={[
                        styles.petTag,
                        selectedPet === pid && { backgroundColor: `${Colors.primary}20`, borderColor: `${Colors.primary}50` },
                      ]}>
                        <Text style={styles.petTagText}>🐾 {petNamesMap[pid] ?? pid}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Stats */}
                <View style={styles.cardStats}>
                  {report.duration_minutes != null && (
                    <View style={styles.chip}>
                      <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                      <Text style={styles.chipText}>{formatDuration(report.duration_minutes)}</Text>
                    </View>
                  )}
                  {report.distance_meters != null && report.distance_meters > 0 && (
                    <View style={styles.chip}>
                      <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                      <Text style={styles.chipText}>{(report.distance_meters / 1000).toFixed(2)} km</Text>
                    </View>
                  )}
                  <View style={styles.chip}>
                    <Ionicons name="chevron-forward" size={12} color={Colors.textSecondary} />
                    <Text style={styles.chipText}>Ver detalhes</Text>
                  </View>
                </View>

                {/* Eventos */}
                {(report.pee_count + report.poop_count + report.note_count) > 0 && (
                  <View style={styles.eventsRow}>
                    {report.pee_count > 0 && (
                      <View style={styles.eventChip}>
                        <Text style={styles.eventEmoji}>💧</Text>
                        <Text style={styles.eventChipText}>{report.pee_count}</Text>
                      </View>
                    )}
                    {report.poop_count > 0 && (
                      <View style={styles.eventChip}>
                        <Text style={styles.eventEmoji}>💩</Text>
                        <Text style={styles.eventChipText}>{report.poop_count}</Text>
                      </View>
                    )}
                    {report.note_count > 0 && (
                      <View style={styles.eventChip}>
                        <Text style={styles.eventEmoji}>📝</Text>
                        <Text style={styles.eventChipText}>{report.note_count}</Text>
                      </View>
                    )}
                  </View>
                )}

                {report.notes ? (
                  <Text style={styles.notes} numberOfLines={2}>{report.notes}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 12, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },

  filterRow: { gap: 8, paddingBottom: 2 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    flexShrink: 0, alignSelf: 'center',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, flexShrink: 0 },
  filterChipTextActive: { color: '#fff' },

  list: { gap: 12 },
  card: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  cardOwner: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#10B98115', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  completedText: { fontSize: 11, fontWeight: '600', color: '#10B981' },

  petsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  petTag: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  petTagText: { fontSize: 12, fontWeight: '600', color: Colors.text },

  cardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  eventsRow: { flexDirection: 'row', gap: 8 },
  eventChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  eventEmoji: { fontSize: 13 },
  eventChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },

  notes: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },

  empty: { marginTop: 32, alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
