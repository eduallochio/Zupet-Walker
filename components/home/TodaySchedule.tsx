import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';

type Schedule = {
  id: string;
  scheduled_at: string;
  status: string;
  pet_ids: string[];
  notes: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLOR: Record<string, string> = {
  proposed:  Colors.warning,
  confirmed: Colors.success,
  cancelled: Colors.error,
  done:      Colors.textSecondary,
};
const STATUS_LABEL: Record<string, string> = {
  proposed:  'Aguardando',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  done:      'Concluído',
};

export function TodaySchedule() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walkerProfile?.id) { setLoading(false); return; }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    supabase
      .from('walk_schedules')
      .select('id, scheduled_at, status, pet_ids, notes')
      .eq('walker_id', walkerProfile.id)
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true })
      .then(({ data }) => {
        setSchedules((data ?? []) as Schedule[]);
        setLoading(false);
      });
  }, [walkerProfile?.id]);

  if (loading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />;
  if (schedules.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Agenda de Hoje</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/agenda')} activeOpacity={0.8}>
          <Text style={styles.seeAll}>Ver tudo</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.list}>
        {schedules.map((s, i) => {
          const color = STATUS_COLOR[s.status] ?? Colors.textSecondary;
          return (
            <View key={s.id} style={[styles.row, i < schedules.length - 1 && styles.rowBorder]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View style={styles.rowBody}>
                <Text style={styles.time}>{formatTime(s.scheduled_at)}</Text>
                <Text style={styles.petCount}>
                  {s.pet_ids.length} pet{s.pet_ids.length !== 1 ? 's' : ''}
                  {s.notes ? ` · ${s.notes}` : ''}
                </Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: `${color}20` }]}>
                <Text style={[styles.statusText, { color }]}>{STATUS_LABEL[s.status] ?? s.status}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  list: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowBody: { flex: 1 },
  time: { fontSize: 14, fontWeight: '700', color: Colors.text },
  petCount: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  statusChip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
});
