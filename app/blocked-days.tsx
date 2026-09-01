import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

export default function BlockedDaysScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const fetchWalkerProfile = useAuthStore((s) => s.fetchWalkerProfile);

  const today = new Date();
  const [viewYear, setViewYear]     = useState(today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(today.getMonth());
  const [blockedDays, setBlockedDays] = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!walkerProfile?.id) return;
    (async () => {
      const { data } = await supabase
        .from('walker_profiles')
        .select('blocked_days')
        .eq('id', walkerProfile.id)
        .maybeSingle();
      const days: string[] = (data as any)?.blocked_days ?? [];
      setBlockedDays(new Set(days));
      setLoading(false);
    })();
  }, [walkerProfile?.id]);

  const toggleDay = (date: Date) => {
    const key = toDateKey(date);
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    if (date < today0) return; // não bloqueia datas passadas
    setBlockedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const save = async () => {
    if (!walkerProfile?.id) return;
    setSaving(true);
    try {
      // Remove datas passadas antes de salvar
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      const cleaned = [...blockedDays].filter((k) => k >= toDateKey(today0));
      const { error } = await supabase
        .from('walker_profiles')
        .update({ blocked_days: cleaned })
        .eq('id', walkerProfile.id);
      if (error) throw error;
      await fetchWalkerProfile();
      Alert.alert('Salvo!', 'Seus dias de folga foram atualizados.');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const cells = buildCalendarDays(viewYear, viewMonth);
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  // Dias bloqueados futuros ordenados
  const todayStr = toDateKey(today0);
  const upcomingBlocked = [...blockedDays]
    .filter((k) => k >= todayStr)
    .sort()
    .slice(0, 5);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Dias de Folga</Text>
          <Text style={styles.subtitle}>Toque em um dia para bloquear/liberar</Text>
        </View>
        <TouchableOpacity onPress={save} style={styles.saveBtn} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Text style={styles.saveText}>Salvar</Text>
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Navegação de mês */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Cabeçalho dos dias da semana */}
          <View style={styles.weekHeader}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekDay}>{d}</Text>
            ))}
          </View>

          {/* Grade do calendário */}
          <View style={styles.grid}>
            {cells.map((date, i) => {
              if (!date) return <View key={`empty-${i}`} style={styles.cell} />;
              const key = toDateKey(date);
              const isPast = date < today0;
              const isToday = toDateKey(date) === toDateKey(today);
              const isBlocked = blockedDays.has(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.cell,
                    isToday && styles.cellToday,
                    isBlocked && styles.cellBlocked,
                    isPast && styles.cellPast,
                  ]}
                  onPress={() => toggleDay(date)}
                  disabled={isPast}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.cellText,
                    isToday && styles.cellTextToday,
                    isBlocked && styles.cellTextBlocked,
                    isPast && styles.cellTextPast,
                  ]}>
                    {date.getDate()}
                  </Text>
                  {isBlocked && <View style={styles.blockedDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legenda */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
              <Text style={styles.legendText}>Dia bloqueado (folga)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Hoje</Text>
            </View>
          </View>

          {/* Próximas folgas */}
          {upcomingBlocked.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRÓXIMAS FOLGAS</Text>
              <View style={styles.card}>
                {upcomingBlocked.map((k, i) => {
                  const d = new Date(k + 'T12:00:00');
                  return (
                    <View key={k} style={[styles.blockedRow, i > 0 && styles.blockedRowBorder]}>
                      <Ionicons name="close-circle" size={16} color={Colors.error} />
                      <Text style={styles.blockedDate}>
                        {WEEKDAYS[d.getDay()]}, {d.getDate()} de {MONTHS[d.getMonth()]}
                      </Text>
                      <TouchableOpacity onPress={() => toggleDay(d)} style={styles.removeBtn}>
                        <Text style={styles.removeBtnText}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {blockedDays.size > 5 && (
                  <Text style={styles.moreText}>+{blockedDays.size - 5} outros dias bloqueados</Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Tutores não poderão agendar serviços nos dias bloqueados.
            </Text>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  headerBtn: { padding: 4 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  saveBtn: { minWidth: 52, alignItems: 'flex-end' },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  scroll: { padding: 20, paddingBottom: 48, gap: 20 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },

  weekHeader: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: Colors.textSecondary, paddingVertical: 6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, gap: 2,
  },
  cellToday: { backgroundColor: `${Colors.primary}18` },
  cellBlocked: { backgroundColor: `${Colors.error}15` },
  cellPast: { opacity: 0.35 },
  cellText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cellTextToday: { color: Colors.primary, fontWeight: '800' },
  cellTextBlocked: { color: Colors.error },
  cellTextPast: { color: Colors.textSecondary },
  blockedDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.error },

  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textSecondary },

  section: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  card: { backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  blockedRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  blockedDate: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${Colors.error}12`, borderRadius: 8 },
  removeBtnText: { fontSize: 12, fontWeight: '600', color: Colors.error },
  moreText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', padding: 10 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
