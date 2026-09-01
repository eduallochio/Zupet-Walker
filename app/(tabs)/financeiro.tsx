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
import { getLimits } from '../../lib/plan';

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
  service_type?: string;  // 'walk' para walk_reports, outro tipo para schedules
  source: 'report' | 'schedule';
};

type LinkedPet = { id: string; name: string };

const SERVICE_TYPE_LABELS: Record<string, string> = {
  walk:      'Passeio',
  daycare:   'Creche',
  boarding:  'Hospedagem',
  training:  'Adestramento',
  bath:      'Banho e Tosa',
  vet_visit: 'Visita ao Vet',
};

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
  const [selectedPet, setSelectedPet]           = useState<string | null>(null);
  const [selectedService, setSelectedService]   = useState<string | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [monthEarnings, setMonthEarnings]       = useState<{ current: number; prev: number; count: number } | null>(null);

  const fetchData = useCallback(async () => {
    if (!walkerProfile) return;

    const limits = getLimits(walkerProfile);

    // 1. walk_reports (passeios com GPS)
    const historyQuery = supabase
      .from('walk_reports')
      .select('id, session_id, duration_minutes, distance_meters, pee_count, poop_count, note_count, notes, photos, sent_at, pet_ids, owner_id')
      .eq('walker_id', walkerProfile.id)
      .order('sent_at', { ascending: false });
    if (isFinite(limits.reportDays)) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limits.reportDays);
      historyQuery.gte('sent_at', cutoff.toISOString());
    }

    // 2. schedules concluídos de outros tipos de serviço
    const schedulesQuery = supabase
      .from('walk_schedules')
      .select('id, scheduled_at, duration_minutes, pet_ids, notes, owner_id, walker_services(type)')
      .eq('walker_id', walkerProfile.id)
      .eq('status', 'done')
      .order('scheduled_at', { ascending: false });

    // 3. Pagamentos para resumo mensal
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const paymentsQuery = supabase
      .from('walker_payments')
      .select('amount, status, paid_at, created_at')
      .eq('walker_id', walkerProfile.id)
      .in('status', ['paid', 'pending'])
      .gte('created_at', firstOfPrevMonth);

    const [reportsRes, schedulesRes, paymentsRes] = await Promise.all([historyQuery, schedulesQuery, paymentsQuery]);

    const payments = (paymentsRes.data ?? []) as { amount: number; status: string; paid_at: string | null; created_at: string }[];
    const currentMonthTotal = payments
      .filter((p) => p.created_at >= firstOfMonth)
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const prevMonthTotal = payments
      .filter((p) => p.created_at >= firstOfPrevMonth && p.created_at < firstOfMonth)
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const currentMonthCount = payments.filter((p) => p.created_at >= firstOfMonth).length;
    setMonthEarnings({ current: currentMonthTotal, prev: prevMonthTotal, count: currentMonthCount });

    const rawReports: WalkReport[] = ((reportsRes.data ?? []) as any[]).map((r) => ({
      ...r,
      service_type: 'walk',
      source: 'report' as const,
      pee_count: r.pee_count ?? 0,
      poop_count: r.poop_count ?? 0,
      note_count: r.note_count ?? 0,
      photos: r.photos ?? [],
    }));

    // Schedules concluídos que NÃO são passeio (passeio já vem pelo walk_reports)
    const rawSchedules: WalkReport[] = ((schedulesRes.data ?? []) as any[])
      .filter((s) => s.walker_services?.type && s.walker_services.type !== 'walk')
      .map((s) => ({
        id: `sched_${s.id}`,
        session_id: null,
        duration_minutes: s.duration_minutes ?? null,
        distance_meters: null,
        pee_count: 0,
        poop_count: 0,
        note_count: 0,
        notes: s.notes ?? null,
        photos: [],
        sent_at: s.scheduled_at,
        pet_ids: s.pet_ids ?? [],
        owner_id: s.owner_id,
        service_type: s.walker_services?.type ?? 'other',
        source: 'schedule' as const,
      }));

    const raw = [...rawReports, ...rawSchedules].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );

    // Pet IDs únicos
    const allPetIds = [...new Set(raw.flatMap((r) => r.pet_ids ?? []))];
    let petList: LinkedPet[] = [];
    let namesMap: Record<string, string> = {};
    if (allPetIds.length > 0) {
      const { data: petsData } = await supabase.from('pets').select('id, name').in('id', allPetIds);
      (petsData ?? []).forEach((p: any) => { namesMap[p.id] = p.name; });
      petList = (petsData ?? []).map((p: any) => ({ id: p.id, name: p.name }));
    }
    setPets(petList);
    setPetNamesMap(namesMap);

    // Nomes dos tutores
    const ownerIds = [...new Set(raw.map((r) => r.owner_id))];
    let ownerNamesMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase.from('user_profiles').select('user_id,name').in('user_id', ownerIds);
      (owners ?? []).forEach((o: any) => { ownerNamesMap[o.user_id] = o.name; });
    }

    setReports(raw.map((r) => ({ ...r, owner_name: ownerNamesMap[r.owner_id] ?? '—' })));
  }, [walkerProfile]);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  // Tipos de serviço presentes no histórico
  const serviceTypes = useMemo(() => {
    const types = [...new Set(reports.map((r) => r.service_type ?? 'walk'))];
    return types;
  }, [reports]);

  // Filtro por pet e por tipo de serviço
  const filtered = useMemo(() => {
    let result = reports;
    if (selectedService) result = result.filter((r) => (r.service_type ?? 'walk') === selectedService);
    if (selectedPet) result = result.filter((r) => r.pet_ids?.includes(selectedPet));
    return result;
  }, [reports, selectedPet, selectedService]);

  // Totais do filtro atual
  const totalMinutes  = filtered.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
  const totalDistance = filtered.reduce((s, r) => s + (r.distance_meters ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
      </View>

      {walkerProfile?.plan !== 'pro' && (
        <View style={styles.planBanner}>
          <Ionicons name="lock-closed-outline" size={14} color="#F59E0B" />
          <Text style={styles.planBannerText}>
            Plano Free: histórico dos últimos 7 dias. Faça upgrade para ver todo o histórico.
          </Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Resumo mensal */}
        {monthEarnings !== null && (
          <View style={styles.monthCard}>
            <View style={styles.monthCardTop}>
              <View>
                <Text style={styles.monthLabel}>
                  {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </Text>
                <Text style={styles.monthValue}>
                  {monthEarnings.current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
                <Text style={styles.monthSub}>{monthEarnings.count} serviço{monthEarnings.count !== 1 ? 's' : ''} no mês</Text>
              </View>
              {monthEarnings.prev > 0 && (
                <View style={[
                  styles.monthDelta,
                  { backgroundColor: monthEarnings.current >= monthEarnings.prev ? '#10B98115' : '#EF444415' },
                ]}>
                  <Ionicons
                    name={monthEarnings.current >= monthEarnings.prev ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={monthEarnings.current >= monthEarnings.prev ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[
                    styles.monthDeltaText,
                    { color: monthEarnings.current >= monthEarnings.prev ? '#10B981' : '#EF4444' },
                  ]}>
                    {monthEarnings.prev > 0
                      ? `${((monthEarnings.current - monthEarnings.prev) / monthEarnings.prev * 100).toFixed(0)}%`
                      : '—'}
                  </Text>
                </View>
              )}
            </View>
            {monthEarnings.prev > 0 && (
              <Text style={styles.monthPrev}>
                Mês anterior: {monthEarnings.prev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            )}
          </View>
        )}

        {/* Totais do filtro */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="paw-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{filtered.length}</Text>
            <Text style={styles.statLabel}>serviços</Text>
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

        {/* Filtro por tipo de serviço — só aparece se houver mais de 1 tipo */}
        {serviceTypes.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, selectedService === null && styles.filterChipActive]}
              onPress={() => setSelectedService(null)}
            >
              <Text style={[styles.filterChipText, selectedService === null && styles.filterChipTextActive]}>Todos</Text>
            </TouchableOpacity>
            {serviceTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, selectedService === type && styles.filterChipActive]}
                onPress={() => setSelectedService(selectedService === type ? null : type)}
              >
                <Text style={[styles.filterChipText, selectedService === type && styles.filterChipTextActive]}>
                  {SERVICE_TYPE_LABELS[type] ?? type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

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
              {selectedPet ? 'Nenhum serviço com este pet' : 'Nenhum serviço ainda'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedPet
                ? 'Nenhum serviço registrado para este pet. Tente outro filtro.'
                : 'Quando você finalizar um serviço, ele aparecerá aqui.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((report) => (
              <TouchableOpacity
                key={report.id}
                style={styles.card}
                activeOpacity={report.source === 'report' ? 0.75 : 1}
                onPress={() => report.source === 'report' && router.push(`/walk-report-detail?id=${report.id}` as any)}
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
                  <View style={styles.badgeRow}>
                    {report.service_type && report.service_type !== 'walk' && (
                      <View style={styles.serviceTypeBadge}>
                        <Text style={styles.serviceTypeText}>{SERVICE_TYPE_LABELS[report.service_type] ?? report.service_type}</Text>
                      </View>
                    )}
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                      <Text style={styles.completedText}>Concluído</Text>
                    </View>
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
                  {report.source === 'report' && (
                    <View style={styles.chip}>
                      <Ionicons name="chevron-forward" size={12} color={Colors.textSecondary} />
                      <Text style={styles.chipText}>Ver detalhes</Text>
                    </View>
                  )}
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

  monthCard: {
    backgroundColor: Colors.primary, borderRadius: 18,
    padding: 18, gap: 10,
  },
  monthCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  monthLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize', marginBottom: 4 },
  monthValue: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  monthSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  monthDelta: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthDeltaText: { fontSize: 13, fontWeight: '700' },
  monthPrev: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  planBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 4, marginTop: 4,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  planBannerText: { flex: 1, fontSize: 12, color: '#F59E0B', fontWeight: '500' },
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
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  serviceTypeBadge: {
    backgroundColor: `${Colors.primary}15`, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  serviceTypeText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
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
