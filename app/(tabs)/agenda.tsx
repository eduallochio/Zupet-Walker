import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { sendPushToOwner } from '../../services/ownerPushService';

type ScheduleStatus = 'proposed' | 'confirmed' | 'cancelled' | 'done';

type PetInfo = { id: string; name: string };

type Schedule = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  pet_ids: string[];
  status: ScheduleStatus;
  notes?: string;
  owner_id: string;
  petNames?: string[];
};

const statusConfig: Record<ScheduleStatus, { label: string; color: string; border: string }> = {
  confirmed: { label: 'Confirmado', color: Colors.success, border: Colors.success },
  proposed:  { label: 'Pendente',   color: Colors.warning, border: Colors.warning },
  cancelled: { label: 'Cancelado',  color: Colors.error,   border: Colors.error   },
  done:      { label: 'Concluído',  color: Colors.textSecondary, border: Colors.border },
};

function buildWeekDays() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AgendaScreen() {
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const schedulesRef = useRef<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const weekDays = buildWeekDays();

  const fetchSchedules = useCallback(async () => {
    if (!walkerProfile) return;
    const { data } = await supabase
      .from('walk_schedules')
      .select('id, scheduled_at, duration_minutes, pet_ids, status, notes, owner_id')
      .eq('walker_id', walkerProfile.id)
      .order('scheduled_at', { ascending: true });

    const rows = (data as Schedule[]) ?? [];

    // Resolve nomes dos pets para todos os schedules em uma única query
    const allPetIds = [...new Set(rows.flatMap((s) => s.pet_ids ?? []))];
    let petMap: Record<string, string> = {};
    if (allPetIds.length > 0) {
      const { data: petsData } = await supabase
        .from('pets')
        .select('id, name')
        .in('id', allPetIds);
      petMap = Object.fromEntries((petsData as PetInfo[] ?? []).map((p) => [p.id, p.name]));
    }

    const enriched = rows.map((s) => ({
      ...s,
      petNames: (s.pet_ids ?? []).map((id) => petMap[id] ?? '—'),
    }));
    schedulesRef.current = enriched;
    setSchedules(enriched);
  }, [walkerProfile]);

  useEffect(() => { fetchSchedules().finally(() => setLoading(false)); }, [fetchSchedules]);

  const onRefresh = async () => { setRefreshing(true); await fetchSchedules(); setRefreshing(false); };

  const updateStatus = async (id: string, newStatus: 'confirmed' | 'cancelled') => {
    const label = newStatus === 'confirmed' ? 'aceitar' : 'recusar';
    Alert.alert(
      newStatus === 'confirmed' ? 'Aceitar agendamento?' : 'Recusar agendamento?',
      `Deseja ${label} este agendamento?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: newStatus === 'confirmed' ? 'Aceitar' : 'Recusar',
          style: newStatus === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase
              .from('walk_schedules')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('id', id);
            if (error) {
              Alert.alert('Erro', 'Não foi possível atualizar o agendamento.');
              return;
            }

            setSchedules((prev) =>
              prev.map((s) => s.id === id ? { ...s, status: newStatus } : s)
            );

            // Notificar o tutor (usa ref para evitar stale closure)
            const schedule = schedulesRef.current.find((s) => s.id === id);
            if (schedule?.owner_id && walkerProfile?.name) {
              const scheduledDate = new Date(schedule.scheduled_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              });
              const notifTitle = newStatus === 'confirmed' ? 'Agendamento confirmado!' : 'Agendamento recusado';
              const notifBody  = newStatus === 'confirmed'
                ? `${walkerProfile.name} confirmou o agendamento de ${scheduledDate}.`
                : `${walkerProfile.name} não pôde aceitar o agendamento de ${scheduledDate}.`;
              await Promise.all([
                supabase.from('notifications').insert({
                  user_id: schedule.owner_id,
                  type:    newStatus === 'confirmed' ? 'schedule_confirmed' : 'schedule_cancelled',
                  title:   notifTitle,
                  body:    notifBody,
                  data:    { schedule_id: id, walker_id: walkerProfile.id },
                }),
                sendPushToOwner(schedule.owner_id, notifTitle, notifBody, {
                  type: newStatus === 'confirmed' ? 'schedule_confirmed' : 'schedule_cancelled',
                  schedule_id: id,
                  walker_id: walkerProfile.id,
                }),
              ]);
            }
          },
        },
      ]
    );
  };

  const daySchedules = schedules.filter((s) => isSameDay(new Date(s.scheduled_at), selectedDay));

  // Próximos 3 dias com agendamentos
  const upcomingDays = weekDays
    .slice(1)
    .filter((d) => schedules.some((s) => isSameDay(new Date(s.scheduled_at), d)));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Agenda</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalText}>{schedules.filter((s) => s.status !== 'cancelled').length} agendamentos</Text>
          </View>
        </View>

        {/* Seletor de dias */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDay);
            const isToday = isSameDay(day, new Date());
            const hasSched = schedules.some((s) => isSameDay(new Date(s.scheduled_at), day));
            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayBtnWeekday, isSelected && styles.dayBtnTextActive]}>
                  {WEEKDAYS[day.getDay()]}
                </Text>
                <Text style={[styles.dayBtnNum, isSelected && styles.dayBtnTextActive]}>
                  {day.getDate()}
                </Text>
                {isToday && !isSelected && <View style={styles.todayDot} />}
                {hasSched && <View style={[styles.schedDot, isSelected && styles.schedDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Agendamentos do dia */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isSameDay(selectedDay, new Date()) ? 'HOJE' : selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </Text>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : daySchedules.length === 0 ? (
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-outline" size={32} color={Colors.border} />
              <Text style={styles.emptyDayText}>Sem agendamentos nesse dia</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {daySchedules.map((item) => {
                const cfg = statusConfig[item.status];
                const time = new Date(item.scheduled_at);
                return (
                  <View key={item.id} style={[styles.card, { borderLeftColor: cfg.border }]}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.cardTime}>
                        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={styles.cardDur}>{item.duration_minutes} min</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <View style={[styles.statusChip, { backgroundColor: `${cfg.color}18` }]}>
                          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      </View>
                      <View style={styles.cardPets}>
                        <Ionicons name="paw-outline" size={12} color={Colors.textSecondary} />
                        <Text style={styles.cardPetsText}>
                          {item.petNames && item.petNames.length > 0
                            ? item.petNames.join(', ')
                            : `${item.pet_ids.length} pet${item.pet_ids.length !== 1 ? 's' : ''}`}
                        </Text>
                      </View>
                      {item.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{item.notes}</Text> : null}

                      {/* Botões aceitar/recusar — apenas para agendamentos pendentes */}
                      {item.status === 'proposed' && (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => updateStatus(item.id, 'cancelled')}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="close" size={14} color={Colors.error} />
                            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Recusar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => updateStatus(item.id, 'confirmed')}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="checkmark" size={14} color="#fff" />
                            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Aceitar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Próximos dias com agendamento */}
        {upcomingDays.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRÓXIMOS DIAS</Text>
            <View style={styles.upcomingRow}>
              {upcomingDays.slice(0, 4).map((d) => {
                const count = schedules.filter((s) => isSameDay(new Date(s.scheduled_at), d)).length;
                return (
                  <TouchableOpacity key={d.toISOString()} style={styles.upcomingChip} onPress={() => setSelectedDay(d)}>
                    <Text style={styles.upcomingDay}>{WEEKDAYS[d.getDay()]}</Text>
                    <Text style={styles.upcomingDate}>{d.getDate()}</Text>
                    <View style={styles.upcomingCount}>
                      <Text style={styles.upcomingCountText}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  totalBadge: { backgroundColor: `${Colors.primary}18`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  totalText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  dayScroll: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  dayBtn: {
    width: 52, paddingVertical: 10, borderRadius: 14,
    alignItems: 'center', gap: 4,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  dayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayBtnWeekday: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  dayBtnNum: { fontSize: 16, fontWeight: '800', color: Colors.text },
  dayBtnTextActive: { color: '#fff' },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  schedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.warning },
  schedDotActive: { backgroundColor: 'rgba(255,255,255,0.8)' },

  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 12 },

  emptyDay: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyDayText: { fontSize: 13, color: Colors.textSecondary },

  cardList: { gap: 10 },
  card: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, overflow: 'hidden',
    padding: 14, gap: 14,
  },
  cardLeft: { alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 44 },
  cardTime: { fontSize: 14, fontWeight: '800', color: Colors.text },
  cardDur: { fontSize: 11, color: Colors.textSecondary },
  cardBody: { flex: 1, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  statusChip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardPets: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardPetsText: { fontSize: 12, color: Colors.textSecondary },
  cardNotes: { fontSize: 12, color: Colors.textSecondary },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: `${Colors.error}40`,
    backgroundColor: `${Colors.error}0D`,
  },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 7, borderRadius: 10,
    backgroundColor: Colors.success,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  upcomingRow: { flexDirection: 'row', gap: 10 },
  upcomingChip: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  upcomingDay: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  upcomingDate: { fontSize: 16, fontWeight: '800', color: Colors.text },
  upcomingCount: {
    backgroundColor: `${Colors.primary}18`, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  upcomingCountText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
});
