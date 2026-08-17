import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function ProfileAvailability() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const availDays  = walkerProfile?.available_days ?? [];
  const startTime  = walkerProfile?.available_start ?? '';
  const endTime    = walkerProfile?.available_end ?? '';

  const hasData = availDays.length > 0 || startTime;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Disponibilidade</Text>
        <TouchableOpacity onPress={() => router.push('/services')} style={styles.editLink} activeOpacity={0.8}>
          <Text style={styles.editLinkText}>Editar</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {!hasData ? (
        <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/services')} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>Configure seus dias e horários em Serviços</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.border} />
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          <View style={styles.daysRow}>
            {DAYS.map((d, i) => {
              const active = availDays.includes(i);
              return (
                <View key={d} style={[styles.dayChip, active && styles.dayChipActive]}>
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
                </View>
              );
            })}
          </View>
          {startTime && endTime && (
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.timeText}>
                {String(startTime).slice(0, 5)} às {String(endTime).slice(0, 5)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  card: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12,
  },
  daysRow: { flexDirection: 'row', gap: 5 },
  dayChip: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  dayChipActive: { backgroundColor: `${Colors.primary}18`, borderColor: Colors.primary },
  dayChipText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.primary },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { fontSize: 13, color: Colors.textSecondary },

  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  emptyText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
});
