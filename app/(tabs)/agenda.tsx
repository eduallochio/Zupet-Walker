import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, FlatList, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { sendPushToOwner } from '../../services/ownerPushService';

type ScheduleStatus = 'proposed' | 'confirmed' | 'cancelled' | 'done' | 'overdue' | 'rescheduled';

type PetInfo = { id: string; name: string; avatar_url?: string | null };

type Schedule = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  pet_ids: string[];
  status: ScheduleStatus;
  notes?: string;
  owner_id: string;
  service_id?: string | null;
  service_type?: string;
  petNames?: string[];
  petAvatars?: (string | null)[];
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  walk:      'Passeio',
  daycare:   'Creche',
  boarding:  'Hospedagem',
  training:  'Adestramento',
  bath:      'Banho e Tosa',
  vet_visit: 'Visita ao Vet',
};

const statusConfig: Record<ScheduleStatus, { label: string; color: string; border: string }> = {
  confirmed: { label: 'Confirmado', color: Colors.success, border: Colors.success },
  proposed:  { label: 'Pendente',   color: Colors.warning, border: Colors.warning },
  cancelled: { label: 'Cancelado',  color: Colors.error,   border: Colors.error   },
  done:      { label: 'Concluído',  color: Colors.textSecondary, border: Colors.border },
  overdue:      { label: 'Atrasado',      color: Colors.error,   border: Colors.error   },
  rescheduled:  { label: 'Reagendando',  color: Colors.primary, border: Colors.primary },
};

function buildWeekDays(overdueSchedules: Schedule[]) {
  const days = [];
  const today = new Date();
  // Inclui dias passados que tenham serviços atrasados
  const overdueDates = overdueSchedules.map((s) => {
    const d = new Date(s.scheduled_at);
    d.setHours(0, 0, 0, 0);
    return d.toDateString();
  });
  const uniqueOverdueDates = [...new Set(overdueDates)].map((ds) => new Date(ds));
  for (const d of uniqueOverdueDates) {
    if (!isSameDay(d, today)) days.push(d);
  }
  // Próximos 7 dias a partir de hoje
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (!days.some((x) => isSameDay(x, d))) days.push(d);
  }
  return days.sort((a, b) => a.getTime() - b.getTime());
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

  const [paymentModal, setPaymentModal] = useState<{ item: Schedule; saving: boolean } | null>(null);
  const [historyModal, setHistoryModal] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState<{ item: Schedule; saving: boolean } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  const fetchSchedules = useCallback(async () => {
    if (!walkerProfile) return;
    const { data } = await supabase
      .from('walk_schedules')
      .select('id, scheduled_at, duration_minutes, pet_ids, status, notes, owner_id, service_id, walker_services(type)')
      .eq('walker_id', walkerProfile.id)
      .order('scheduled_at', { ascending: true });

    const rows = (data as Schedule[]) ?? [];

    // Resolve nomes dos pets para todos os schedules em uma única query
    const allPetIds = [...new Set(rows.flatMap((s) => s.pet_ids ?? []))];
    let petMap: Record<string, PetInfo> = {};
    if (allPetIds.length > 0) {
      const { data: petsData } = await supabase
        .from('pets')
        .select('id, name, avatar_url')
        .in('id', allPetIds);
      petMap = Object.fromEntries((petsData as PetInfo[] ?? []).map((p) => [p.id, p]));
    }

    const enriched = rows.map((s: any) => ({
      ...s,
      service_type: s.walker_services?.type ?? 'walk',
      petNames: (s.pet_ids ?? []).map((id: string) => petMap[id]?.name ?? '—'),
      petAvatars: (s.pet_ids ?? []).map((id: string) => petMap[id]?.avatar_url ?? null),
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

            // Atualiza blocked_slots do serviço ao aceitar ou cancelar
            const schedule = schedulesRef.current.find((s) => s.id === id);
            if (schedule?.service_id) {
              const scheduledDate = new Date(schedule.scheduled_at);
              const dateKey = scheduledDate.toISOString().split('T')[0];
              const timeSlot = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`;

              const [{ data: svcData }, { count: confirmedCount }] = await Promise.all([
                supabase.from('walker_services').select('blocked_slots, max_pets, price, label, type').eq('id', schedule.service_id).maybeSingle(),
                supabase.from('walk_schedules')
                  .select('id', { count: 'exact', head: true })
                  .eq('service_id', schedule.service_id)
                  .eq('status', 'confirmed')
                  .gte('scheduled_at', `${dateKey}T00:00:00`)
                  .lt('scheduled_at', `${dateKey}T23:59:59`)
                  .eq('scheduled_at', schedule.scheduled_at),
              ]);

              if (svcData) {
                const blocked: Record<string, string[]> = svcData.blocked_slots ?? {};
                const daySlots: string[] = blocked[dateKey] ?? [];
                const maxPets: number = svcData.max_pets ?? 1;

                if (newStatus === 'confirmed') {
                  // Bloqueia o slot somente quando atingir a capacidade máxima
                  const totalConfirmed = (confirmedCount ?? 0) + 1; // +1 incluindo o que acabou de ser aceito
                  if (totalConfirmed >= maxPets && !daySlots.includes(timeSlot)) {
                    blocked[dateKey] = [...daySlots, timeSlot];
                  }
                } else {
                  // Ao cancelar/recusar, libera o slot
                  blocked[dateKey] = daySlots.filter((s) => s !== timeSlot);
                  if (blocked[dateKey].length === 0) delete blocked[dateKey];
                }

                await supabase
                  .from('walker_services')
                  .update({ blocked_slots: blocked })
                  .eq('id', schedule.service_id);
              }

              // Ao aceitar, cria registro financeiro pendente (reutiliza svcData já carregado)
              if (newStatus === 'confirmed' && walkerProfile && svcData) {
                const { data: existing } = await supabase
                  .from('walker_payments')
                  .select('id')
                  .eq('schedule_id', id)
                  .maybeSingle();
                if (!existing) {
                  await supabase.from('walker_payments').insert({
                    walker_id:    walkerProfile.id,
                    owner_id:     schedule.owner_id,
                    schedule_id:  id,
                    service_type: (svcData as any).type ?? schedule.service_type ?? 'walk',
                    description:  (svcData as any).label ?? SERVICE_TYPE_LABELS[schedule.service_type ?? 'walk'] ?? 'Serviço',
                    amount:       (svcData as any).price ?? 0,
                    billing_type: 'per_session',
                    status:       'pending',
                  });
                }
              }
            }

            // Notificar o tutor (usa ref para evitar stale closure)
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

  const finalizeService = (item: Schedule) => {
    setPaymentModal({ item, saving: false });
  };

  const openReschedule = (item: Schedule) => {
    const d = new Date(item.scheduled_at);
    setRescheduleDate(d.toLocaleDateString('pt-BR'));
    setRescheduleTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    setRescheduleNotes('');
    setRescheduleModal({ item, saving: false });
  };

  const doReschedule = async () => {
    if (!rescheduleModal || !walkerProfile) return;
    const item = rescheduleModal.item;

    // Valida data e hora no formato dd/mm/aaaa e HH:mm
    const [day, month, year] = rescheduleDate.split('/').map(Number);
    const [hour, minute] = rescheduleTime.split(':').map(Number);
    if (!day || !month || !year || isNaN(hour) || isNaN(minute)) {
      Alert.alert('Data inválida', 'Informe a data (dd/mm/aaaa) e hora (HH:mm) corretamente.');
      return;
    }
    const proposed = new Date(year, month - 1, day, hour, minute);
    if (proposed <= new Date()) {
      Alert.alert('Data inválida', 'O novo horário deve ser no futuro.');
      return;
    }

    setRescheduleModal((prev) => prev ? { ...prev, saving: true } : null);
    try {
      const { error } = await supabase
        .from('walk_schedules')
        .update({
          status: 'rescheduled',
          reschedule_proposed_at: proposed.toISOString(),
          reschedule_notes: rescheduleNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (error) throw error;

      setSchedules((prev) => prev.map((s) => s.id === item.id ? { ...s, status: 'rescheduled' as any } : s));

      // Notifica tutor
      if (item.owner_id && walkerProfile.name) {
        const dateLabel = proposed.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        const title = '🔄 Reagendamento proposto';
        const body  = `${walkerProfile.name} propôs um novo horário: ${dateLabel}. Abra o app para aceitar.`;
        await Promise.all([
          supabase.from('notifications').insert({
            user_id: item.owner_id,
            type: 'reschedule_proposed',
            title,
            body,
            data: { schedule_id: item.id, walker_id: walkerProfile.id, new_date: proposed.toISOString() },
          }),
          sendPushToOwner(item.owner_id, title, body, {
            type: 'reschedule_proposed',
            schedule_id: item.id,
            new_date: proposed.toISOString(),
          }),
        ]);
      }

      setRescheduleModal(null);
      Alert.alert('Proposta enviada!', 'O tutor será notificado para aceitar o novo horário.');
    } catch {
      Alert.alert('Erro', 'Não foi possível propor o reagendamento.');
      setRescheduleModal((prev) => prev ? { ...prev, saving: false } : null);
    }
  };

  const doFinalize = async (paymentMethod: 'cash' | 'pix' | 'card' | 'skip') => {
    if (!paymentModal) return;
    const item = paymentModal.item;
    setPaymentModal((prev) => prev ? { ...prev, saving: true } : null);

    try {
      const { error } = await supabase
        .from('walk_schedules')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;

      setSchedules((prev) => prev.map((s) => s.id === item.id ? { ...s, status: 'done' } : s));

      // Atualizar registro financeiro pendente com método e status paid
      if (paymentMethod !== 'skip' && walkerProfile) {
        await supabase.from('walker_payments')
          .update({
            payment_method: paymentMethod,
            status:         'paid',
            paid_at:        new Date().toISOString(),
          })
          .eq('schedule_id', item.id);
      }

      // Notificar tutor para avaliar
      if (item.owner_id && walkerProfile?.name) {
        const serviceLabel = SERVICE_TYPE_LABELS[item.service_type ?? 'walk'] ?? 'Serviço';
        const title = `${serviceLabel} concluído!`;
        const body  = `${walkerProfile.name} concluiu o serviço. Avalie como foi!`;
        await Promise.all([
          supabase.from('notifications').insert({
            user_id: item.owner_id,
            type:    'service_done',
            title,
            body,
            data:    { schedule_id: item.id, walker_id: walkerProfile.id, service_type: item.service_type ?? 'walk' },
          }),
          sendPushToOwner(item.owner_id, title, body, {
            type:         'service_done',
            schedule_id:  item.id,
            walker_id:    walkerProfile.id,
            service_type: item.service_type ?? 'walk',
          }),
        ]);
      }

      setPaymentModal(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível finalizar o serviço.');
      setPaymentModal((prev) => prev ? { ...prev, saving: false } : null);
    }
  };

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const overdueItems = schedules
    .filter((s) => s.status === 'confirmed' && new Date(s.scheduled_at) < startOfToday)
    .map((s) => ({ ...s, status: 'overdue' as ScheduleStatus }));
  const weekDays = buildWeekDays(overdueItems);

  const daySchedules = schedules
    .filter((s) => isSameDay(new Date(s.scheduled_at), selectedDay))
    .map((s) => overdueItems.find((o) => o.id === s.id) ?? s);

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
          <TouchableOpacity style={styles.totalBadge} onPress={() => setHistoryModal(true)} activeOpacity={0.75}>
            <Text style={styles.totalText}>{schedules.filter((s) => s.status !== 'cancelled').length} agendamentos</Text>
            <Ionicons name="time-outline" size={13} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Seção de serviços atrasados */}
        {overdueItems.length > 0 && (
          <View style={styles.overdueSection}>
            <View style={styles.overdueHeader}>
              <Ionicons name="warning" size={14} color={Colors.error} />
              <Text style={styles.overdueTitle}>ATENÇÃO — SERVIÇOS ATRASADOS</Text>
            </View>
            <View style={styles.cardList}>
              {overdueItems.map((item) => {
                const cfg = statusConfig['overdue'];
                const time = new Date(item.scheduled_at);
                return (
                  <View key={item.id} style={[styles.card, { borderLeftColor: cfg.border }]}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.cardTime}>{time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                      <Text style={styles.cardDur}>{time.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <View style={[styles.statusChip, { backgroundColor: `${cfg.color}18` }]}>
                          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {item.service_type && item.service_type !== 'walk' && (
                          <View style={styles.serviceChip}>
                            <Text style={styles.serviceChipText}>{SERVICE_TYPE_LABELS[item.service_type]}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardPets}>
                        {(item.petAvatars ?? []).slice(0, 3).map((uri, i) =>
                          uri ? (
                            <Image key={i} source={{ uri }} style={styles.petAvatar} />
                          ) : (
                            <View key={i} style={styles.petAvatarPlaceholder}>
                              <Ionicons name="paw" size={10} color={Colors.primary} />
                            </View>
                          )
                        )}
                        <Text style={styles.cardPetsText}>
                          {item.petNames && item.petNames.length > 0
                            ? item.petNames.join(', ')
                            : `${item.pet_ids.length} pet${item.pet_ids.length !== 1 ? 's' : ''}`}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.finalizeBtn} onPress={() => finalizeService(item)} activeOpacity={0.75}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                        <Text style={[styles.actionBtnText, { color: '#fff' }]}>Finalizar serviço</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

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
                        {item.service_type && item.service_type !== 'walk' && (
                          <View style={styles.serviceChip}>
                            <Text style={styles.serviceChipText}>{SERVICE_TYPE_LABELS[item.service_type]}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardPets}>
                        {(item.petAvatars ?? []).slice(0, 3).map((uri, i) =>
                          uri ? (
                            <Image key={i} source={{ uri }} style={styles.petAvatar} />
                          ) : (
                            <View key={i} style={styles.petAvatarPlaceholder}>
                              <Ionicons name="paw" size={10} color={Colors.primary} />
                            </View>
                          )
                        )}
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

                      {/* Botões finalizar + reagendar — confirmados ou atrasados */}
                      {(item.status === 'confirmed' || item.status === 'overdue') && (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.rescheduleBtn}
                            onPress={() => openReschedule(item)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
                            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Reagendar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.finalizeBtn, { flex: 1 }]}
                            onPress={() => finalizeService(item)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Finalizar</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Badge reagendamento proposto */}
                      {item.status === 'rescheduled' && (
                        <View style={styles.rescheduledBadge}>
                          <Ionicons name="time-outline" size={13} color={Colors.primary} />
                          <Text style={styles.rescheduledText}>Aguardando tutor aceitar novo horário</Text>
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
      {/* Modal histórico de agendamentos */}
      <Modal visible={historyModal} transparent animationType="slide" onRequestClose={() => setHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.modalTitle}>Histórico</Text>
              <TouchableOpacity onPress={() => setHistoryModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { marginBottom: 12 }]}>Serviços concluídos</Text>
            <FlatList
              data={[...schedules].filter((s) => s.status === 'done').sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={<Text style={{ color: Colors.textSecondary, textAlign: 'center', marginTop: 20 }}>Nenhum serviço concluído ainda.</Text>}
              renderItem={({ item }) => {
                const cfg = statusConfig[item.status];
                const time = new Date(item.scheduled_at);
                return (
                  <View style={[styles.card, { borderLeftColor: cfg.border }]}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.cardTime}>{time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                      <Text style={styles.cardDur}>{time.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <View style={[styles.statusChip, { backgroundColor: `${cfg.color}18` }]}>
                          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {item.service_type && (
                          <View style={styles.serviceChip}>
                            <Text style={styles.serviceChipText}>{SERVICE_TYPE_LABELS[item.service_type] ?? item.service_type}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardPets}>
                        {(item.petAvatars ?? []).slice(0, 3).map((uri, i) =>
                          uri ? (
                            <Image key={i} source={{ uri }} style={styles.petAvatar} />
                          ) : (
                            <View key={i} style={styles.petAvatarPlaceholder}>
                              <Ionicons name="paw" size={10} color={Colors.primary} />
                            </View>
                          )
                        )}
                        <Text style={styles.cardPetsText}>
                          {item.petNames && item.petNames.length > 0
                            ? item.petNames.join(', ')
                            : `${item.pet_ids.length} pet${item.pet_ids.length !== 1 ? 's' : ''}`}
                        </Text>
                      </View>
                      {item.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{item.notes}</Text> : null}
                    </View>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de pagamento ao finalizar serviço */}
      <Modal visible={!!paymentModal} transparent animationType="slide" onRequestClose={() => setPaymentModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Finalizar serviço</Text>
            <Text style={styles.modalSub}>Como foi recebido o pagamento?</Text>

            {(['cash', 'pix', 'card'] as const).map((method) => {
              const labels = { cash: '💵 Dinheiro', pix: '📲 PIX', card: '💳 Cartão' };
              return (
                <TouchableOpacity
                  key={method}
                  style={styles.paymentBtn}
                  onPress={() => doFinalize(method)}
                  disabled={paymentModal?.saving}
                  activeOpacity={0.8}
                >
                  {paymentModal?.saving
                    ? <ActivityIndicator size="small" color={Colors.primary} />
                    : <Text style={styles.paymentBtnText}>{labels[method]}</Text>
                  }
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => doFinalize('skip')}
              disabled={paymentModal?.saving}
              activeOpacity={0.8}
            >
              <Text style={styles.skipBtnText}>Finalizar sem lançar no financeiro</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPaymentModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de reagendamento */}
      <Modal visible={!!rescheduleModal} transparent animationType="slide" onRequestClose={() => setRescheduleModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Propor reagendamento</Text>
            <Text style={styles.modalSub}>O tutor será notificado e poderá aceitar ou recusar.</Text>

            <View style={styles.rescheduleField}>
              <Text style={styles.rescheduleLabel}>Nova data (dd/mm/aaaa)</Text>
              <TextInput
                style={styles.rescheduleInput}
                value={rescheduleDate}
                onChangeText={setRescheduleDate}
                placeholder="ex: 05/09/2026"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            <View style={styles.rescheduleField}>
              <Text style={styles.rescheduleLabel}>Novo horário (HH:mm)</Text>
              <TextInput
                style={styles.rescheduleInput}
                value={rescheduleTime}
                onChangeText={setRescheduleTime}
                placeholder="ex: 14:30"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            <View style={styles.rescheduleField}>
              <Text style={styles.rescheduleLabel}>Motivo (opcional)</Text>
              <TextInput
                style={[styles.rescheduleInput, { height: 72, textAlignVertical: 'top' }]}
                value={rescheduleNotes}
                onChangeText={setRescheduleNotes}
                placeholder="Ex: compromisso imprevisto..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                maxLength={200}
              />
            </View>

            <TouchableOpacity
              style={styles.finalizeBtn}
              onPress={doReschedule}
              disabled={rescheduleModal?.saving}
              activeOpacity={0.8}
            >
              {rescheduleModal?.saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="calendar-outline" size={14} color="#fff" />
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>Enviar proposta</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setRescheduleModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  totalBadge: { backgroundColor: `${Colors.primary}18`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
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
  cardPets: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardPetsText: { fontSize: 12, color: Colors.textSecondary, flexShrink: 1 },
  petAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  petAvatarPlaceholder: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
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
  finalizeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 7, borderRadius: 10, marginTop: 4,
    backgroundColor: Colors.primary,
  },
  serviceChip: {
    marginLeft: 6, backgroundColor: `${Colors.primary}15`,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  serviceChipText: { fontSize: 10, fontWeight: '600', color: Colors.primary },

  rescheduleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: `${Colors.primary}40`,
    backgroundColor: `${Colors.primary}0D`,
  },
  rescheduledBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary}10`, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginTop: 4,
  },
  rescheduledText: { fontSize: 12, color: Colors.primary, fontWeight: '500', flex: 1 },
  rescheduleField: { gap: 4 },
  rescheduleLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  rescheduleInput: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: Colors.text,
  },

  overdueSection: { marginHorizontal: 20, marginTop: 16, marginBottom: 4, gap: 10 },
  overdueHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overdueTitle: { fontSize: 11, fontWeight: '700', color: Colors.error, letterSpacing: 0.6 },

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

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  modalSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  paymentBtn: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 16, alignItems: 'center',
  },
  paymentBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text },
  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipBtnText: { fontSize: 13, color: Colors.textSecondary, textDecorationLine: 'underline' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.error },
});
