import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { WalkSession } from '../../types/walker';

type Props = { item: WalkSession; servicePrice?: number };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function SessionCard({ item, servicePrice }: Props) {
  // Estima valor: preço do serviço × (duração em horas)
  const earned = servicePrice && item.duration_minutes
    ? (servicePrice / 60) * item.duration_minutes
    : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75}>
      <View style={styles.top}>
        <View style={styles.petRow}>
          <Ionicons name="paw" size={13} color={Colors.primary} />
          <Text style={styles.petText}>
            {item.pet_ids.length} pet{item.pet_ids.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {earned != null && (
          <Text style={styles.earned}>+ R$ {earned.toFixed(2).replace('.', ',')}</Text>
        )}
      </View>

      <View style={styles.meta}>
        {item.started_at && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>
              {formatTime(item.started_at)}{item.ended_at ? ` – ${formatTime(item.ended_at)}` : ''}
            </Text>
          </View>
        )}
        {item.duration_minutes != null && (
          <View style={styles.metaItem}>
            <Ionicons name="walk-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{formatDuration(item.duration_minutes)}</Text>
          </View>
        )}
        {item.distance_meters != null && (
          <View style={styles.metaItem}>
            <Ionicons name="navigate-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{(item.distance_meters / 1000).toFixed(1)} km</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  petText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  earned: { fontSize: 15, fontWeight: '800', color: Colors.success },
  meta: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
});
