import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ALL_SLOTS = [
  '06:00','07:00','08:00','09:00','10:00','11:00',
  '12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00',
];

// available_slots: { "1": ["08:00","10:00"], "6": ["07:00"] }
export type AvailableSlots = Record<string, string[]>;

type Props = {
  value: AvailableSlots;
  onChange: (v: AvailableSlots) => void;
};

export default function AvailabilityEditor({ value, onChange }: Props) {
  const toggleDay = (dayIdx: number) => {
    const key = String(dayIdx);
    const next = { ...value };
    if (next[key]) {
      delete next[key];
    } else {
      next[key] = [];
    }
    onChange(next);
  };

  const toggleSlot = (dayIdx: number, slot: string) => {
    const key = String(dayIdx);
    const current = value[key] ?? [];
    const next = { ...value };
    if (current.includes(slot)) {
      next[key] = current.filter((s) => s !== slot);
    } else {
      next[key] = [...current, slot].sort();
    }
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Selecione os dias e os horários que você oferece atendimento.
      </Text>

      {DAYS.map((dayName, dayIdx) => {
        const key = String(dayIdx);
        const isActive = key in value;
        const slots = value[key] ?? [];

        return (
          <View key={dayIdx} style={[styles.dayBlock, { borderColor: isActive ? Colors.primary : Colors.border }]}>
            {/* Cabeçalho do dia */}
            <TouchableOpacity
              style={[styles.dayHeader, isActive && { backgroundColor: Colors.primary + '10' }]}
              onPress={() => toggleDay(dayIdx)}
              activeOpacity={0.75}
            >
              <View style={[styles.dayCheck, isActive && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                {isActive && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={[styles.dayName, isActive && { color: Colors.primary, fontWeight: '700' }]}>
                {dayName}
              </Text>
              {isActive && slots.length > 0 && (
                <Text style={styles.slotCount}>{slots.length} horário{slots.length > 1 ? 's' : ''}</Text>
              )}
              {isActive && slots.length === 0 && (
                <Text style={styles.slotCountWarn}>nenhum horário</Text>
              )}
              <Ionicons
                name={isActive ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isActive ? Colors.primary : Colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Grid de horários (visível só se o dia estiver ativo) */}
            {isActive && (
              <View style={styles.slotsGrid}>
                {ALL_SLOTS.map((slot) => {
                  const selected = slots.includes(slot);
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[
                        styles.slotChip,
                        selected
                          ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                          : { backgroundColor: Colors.background, borderColor: Colors.border },
                      ]}
                      onPress={() => toggleSlot(dayIdx, slot)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.slotText, selected && { color: '#fff' }]}>{slot}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  dayBlock: {
    borderRadius: 14, borderWidth: 1.5, overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  dayCheck: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dayName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  slotCount: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  slotCountWarn: { fontSize: 12, color: Colors.warning, fontWeight: '600' },

  slotsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  slotChip: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, minWidth: 68, alignItems: 'center',
  },
  slotText: { fontSize: 13, fontWeight: '600', color: Colors.text },
});
