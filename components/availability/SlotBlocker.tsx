import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type BlockedSlots = Record<string, string[]>;

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildNext14Days(): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

type Props = {
  availableSlots: Record<string, string[]>;
  blockedSlots: BlockedSlots;
  onChange: (blocked: BlockedSlots) => void;
};

export default function SlotBlocker({ availableSlots, blockedSlots, onChange }: Props) {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const days = buildNext14Days();

  const dateKey = toISO(selectedDay);
  const slotsForDay = availableSlots[String(selectedDay.getDay())] ?? [];
  const blockedToday = blockedSlots[dateKey] ?? [];

  const toggleBlock = (slot: string) => {
    const current = blockedSlots[dateKey] ?? [];
    const next = { ...blockedSlots };
    if (current.includes(slot)) {
      next[dateKey] = current.filter((s) => s !== slot);
      if (next[dateKey].length === 0) delete next[dateKey];
    } else {
      next[dateKey] = [...current, slot].sort();
    }
    onChange(next);
  };

  return (
    <View style={styles.container}>

      {/* Seletor de data */}
      <Text style={styles.sectionLabel}>SELECIONE O DIA</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map((day) => {
          const isSelected = toISO(day) === toISO(selectedDay);
          const key = toISO(day);
          const hasBlocked = (blockedSlots[key] ?? []).length > 0;
          const hasSlots = (availableSlots[String(day.getDay())] ?? []).length > 0;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.dayBtn,
                isSelected && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                !hasSlots && !isSelected && { opacity: 0.4 },
              ]}
              onPress={() => setSelectedDay(day)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayWeekday, isSelected && { color: '#fff' }]}>
                {DAYS_PT[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, isSelected && { color: '#fff' }]}>
                {day.getDate()}
              </Text>
              {hasBlocked && (
                <View style={[styles.blockedDot, isSelected && { backgroundColor: '#fff' }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Label do dia selecionado */}
      <Text style={styles.sectionLabel}>
        {DAYS_PT[selectedDay.getDay()].toUpperCase()}, {selectedDay.getDate()}/{selectedDay.getMonth() + 1} — HORÁRIOS
      </Text>

      {/* Grid de slots */}
      {slotsForDay.length === 0 ? (
        <View style={styles.emptyDay}>
          <Ionicons name="calendar-outline" size={36} color={Colors.border} />
          <Text style={styles.emptyDayTitle}>Sem horários neste dia</Text>
          <Text style={styles.emptyDayText}>
            Configure os horários disponíveis na edição do serviço.
          </Text>
        </View>
      ) : (
        <View style={styles.slotsGrid}>
          {slotsForDay.map((slot) => {
            const isBlocked = blockedToday.includes(slot);
            return (
              <TouchableOpacity
                key={slot}
                style={[
                  styles.slotChip,
                  isBlocked
                    ? { backgroundColor: Colors.error + '15', borderColor: Colors.error + '60' }
                    : { backgroundColor: Colors.success + '15', borderColor: Colors.success + '60' },
                ]}
                onPress={() => toggleBlock(slot)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={isBlocked ? 'close-circle' : 'checkmark-circle'}
                  size={15}
                  color={isBlocked ? Colors.error : Colors.success}
                />
                <Text style={[styles.slotText, { color: isBlocked ? Colors.error : Colors.success }]}>
                  {slot}
                </Text>
                <Text style={[styles.slotStatus, { color: isBlocked ? Colors.error : Colors.success }]}>
                  {isBlocked ? 'Ocupado' : 'Livre'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Legenda */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>Livre — disponível para agendamento</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
          <Text style={styles.legendText}>Ocupado — não aparece para tutores</Text>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },

  dayRow: { gap: 8, paddingBottom: 4 },
  dayBtn: {
    width: 56, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.card,
    alignItems: 'center', gap: 3,
  },
  dayWeekday: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  dayNum: { fontSize: 17, fontWeight: '800', color: Colors.text },
  blockedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },

  emptyDay: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyDayTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  emptyDayText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, minWidth: 130,
  },
  slotText: { fontSize: 15, fontWeight: '700' },
  slotStatus: { fontSize: 11, fontWeight: '600' },

  legend: {
    gap: 6, padding: 14, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
});
