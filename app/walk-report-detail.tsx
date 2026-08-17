import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';

type Report = {
  id: string;
  session_id: string | null;
  walker_id: string;
  duration_minutes: number | null;
  distance_meters: number | null;
  pee_count: number;
  poop_count: number;
  note_count: number;
  notes: string | null;
  photos: string[];
  sent_at: string;
  pet_ids: string[] | null;
  owner_id: string;
};

type WalkEvent = {
  id: string;
  type: 'pee' | 'poop' | 'interaction' | 'mood' | 'note';
  pet_id: string;
  value?: string | null;
  recorded_at: string;
};

const EVENT_META: Record<string, { emoji: string; label: string }> = {
  pee:         { emoji: '💧', label: 'Xixi'      },
  poop:        { emoji: '💩', label: 'Cocô'      },
  interaction: { emoji: '🐾', label: 'Interação' },
  mood:        { emoji: '😊', label: 'Humor'     },
  note:        { emoji: '📝', label: 'Nota'      },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatTime(iso: string | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function WalkReportDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [report, setReport]     = useState<Report | null>(null);
  const [events, setEvents]     = useState<WalkEvent[]>([]);
  const [petNames, setPetNames] = useState<Record<string, string>>({});
  const [ownerName, setOwnerName] = useState('—');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('walk_reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!data) { setLoading(false); return; }
      const rep = data as Report;
      setReport(rep);


      // Carregar em paralelo: eventos, nomes dos pets, nome do tutor
      const [evRes, petsRes, ownerRes] = await Promise.all([
        rep.session_id
          ? supabase
              .from('walk_events')
              .select('id, type, pet_id, value, recorded_at')
              .eq('session_id', rep.session_id)
              .order('recorded_at', { ascending: true })
          : Promise.resolve({ data: [] }),

        (rep.pet_ids?.length ?? 0) > 0
          ? supabase.from('pets').select('id, name').in('id', rep.pet_ids!)
          : Promise.resolve({ data: [] }),

        supabase
          .from('user_profiles')
          .select('name')
          .eq('user_id', rep.owner_id)
          .maybeSingle(),
      ]);

      setEvents((evRes.data ?? []) as WalkEvent[]);

      const map: Record<string, string> = {};
      (petsRes.data ?? []).forEach((p: any) => { map[p.id] = p.name; });
      setPetNames(map);

      setOwnerName((ownerRes.data as any)?.name ?? '—');
      setLoading(false);
    })();
  }, [id]);

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Detalhes do Passeio</Text>
      <View style={{ width: 38 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header />
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Relatório não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Agrupar eventos por pet
  const petIds = report.pet_ids ?? [];
  const eventsByPet: Record<string, WalkEvent[]> = {};
  petIds.forEach((pid) => { eventsByPet[pid] = []; });
  events.forEach((ev) => {
    if (!eventsByPet[ev.pet_id]) eventsByPet[ev.pet_id] = [];
    eventsByPet[ev.pet_id].push(ev);
  });

  const hasPhotos = (report.photos ?? []).length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Tutor + data + badge */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName}>{ownerName}</Text>
              <Text style={styles.dateText}>{formatDate(report.sent_at)}</Text>
            </View>
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.doneText}>Concluído</Text>
            </View>
          </View>
        </View>

        {/* Pets */}
        {petIds.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PETS DO PASSEIO</Text>
            <View style={styles.chipsRow}>
              {petIds.map((pid) => (
                <View key={`${pid}-${petNames[pid] ?? ''}`} style={styles.petChip}>
                  <Text style={styles.petChipText}>
                    {petNames[pid] || pid}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>RESUMO</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>
                {report.duration_minutes != null ? formatDuration(report.duration_minutes) : '—'}
              </Text>
              <Text style={styles.statLabel}>duração</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>
                {report.distance_meters != null && report.distance_meters > 0
                  ? `${(report.distance_meters / 1000).toFixed(2)} km`
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>distância</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{events.length}</Text>
              <Text style={styles.statLabel}>eventos</Text>
            </View>
          </View>

          {/* Contadores rápidos */}
          {(report.pee_count + report.poop_count + report.note_count) > 0 && (
            <View style={styles.quickCountsRow}>
              {report.pee_count > 0 && (
                <View style={styles.quickCount}>
                  <Text style={styles.quickEmoji}>💧</Text>
                  <Text style={styles.quickText}>{report.pee_count}×</Text>
                </View>
              )}
              {report.poop_count > 0 && (
                <View style={styles.quickCount}>
                  <Text style={styles.quickEmoji}>💩</Text>
                  <Text style={styles.quickText}>{report.poop_count}×</Text>
                </View>
              )}
              {report.note_count > 0 && (
                <View style={styles.quickCount}>
                  <Text style={styles.quickEmoji}>📝</Text>
                  <Text style={styles.quickText}>{report.note_count}×</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Eventos por pet */}
        {petIds.map((pid) => {
          const petEvents = eventsByPet[pid] ?? [];
          if (petEvents.length === 0) return null;
          return (
            <View key={pid} style={styles.card}>
              <View style={styles.petEventHeader}>
                <View style={styles.petEventAvatar}>
                  <Text style={{ fontSize: 14 }}>🐾</Text>
                </View>
                <Text style={styles.petEventName}>{petNames[pid] ?? pid}</Text>
                <View style={styles.eventCountBadge}>
                  <Text style={styles.eventCountText}>{petEvents.length} eventos</Text>
                </View>
              </View>

              <View style={styles.eventList}>
                {petEvents.map((ev, idx) => {
                  const meta = EVENT_META[ev.type] ?? { emoji: '•', label: ev.type };
                  const isLast = idx === petEvents.length - 1;
                  return (
                    <View key={ev.id} style={[styles.eventRow, isLast && { borderBottomWidth: 0 }]}>
                      <Text style={styles.eventEmoji}>{meta.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventType}>{meta.label}</Text>
                        {ev.value ? <Text style={styles.eventNote}>{ev.value}</Text> : null}
                      </View>
                      <Text style={styles.eventTime}>{formatTime(ev.recorded_at)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Obs. gerais do walker */}
        {report.notes ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>OBSERVAÇÕES DO PASSEIO</Text>
            <Text style={styles.notesText}>{report.notes}</Text>
          </View>
        ) : null}

        {/* Fotos */}
        {hasPhotos && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>FOTOS ({report.photos.length})</Text>
            <View style={styles.photosGrid}>
              {report.photos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.photo} resizeMode="cover" />
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  scroll: { padding: 16, gap: 12, paddingBottom: 48 },

  card: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  ownerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  dateText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#10B98115', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  doneText: { fontSize: 11, fontWeight: '600', color: '#10B981' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  petChip: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: `${Colors.primary}12`,
    borderWidth: 1, borderColor: `${Colors.primary}30`,
    alignSelf: 'flex-start',
  },
  petChipText: { fontSize: 13, fontWeight: '600', color: Colors.text, flexShrink: 0 },

  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statCell: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  quickCountsRow: {
    flexDirection: 'row', gap: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  quickCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickEmoji: { fontSize: 18 },
  quickText: { fontSize: 14, fontWeight: '700', color: Colors.text },

  petEventHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  petEventAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  petEventName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  eventCountBadge: {
    backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  eventCountText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  eventList: { gap: 0 },
  eventRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  eventEmoji: { fontSize: 20, width: 28, textAlign: 'center', marginTop: 1 },
  eventType: { fontSize: 14, fontWeight: '600', color: Colors.text },
  eventNote: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 19 },
  eventTime: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },

  notesText: { fontSize: 14, color: Colors.text, lineHeight: 22 },

  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '47%', aspectRatio: 1, borderRadius: 10, backgroundColor: Colors.border },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
