import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type NotifType =
  | 'service_requested'
  | 'pet_unlinked_by_tutor'
  | 'pet_linked'
  | 'schedule_confirmed'
  | 'schedule_cancelled'
  | string;

export type NotificationData = {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  service_requested:    { name: 'calendar-outline',     color: '#2196F3' },
  pet_unlinked_by_tutor:{ name: 'close-circle-outline', color: '#EF4444' },
  pet_linked:           { name: 'link-outline',         color: '#4CAF50' },
  schedule_confirmed:   { name: 'checkmark-circle-outline', color: '#4CAF50' },
  schedule_cancelled:   { name: 'close-circle-outline', color: '#EF4444' },
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH  = Math.floor(diffMs / 3600000);
  const diffD  = Math.floor(diffH / 24);
  if (diffH < 1) return 'Agora mesmo';
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD === 1) return 'Ontem';
  if (diffD < 7)  return `${diffD} dias atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

type Props = {
  item: NotificationData;
  onPress?: (item: NotificationData) => void;
};

export default function NotificationItem({ item, onPress }: Props) {
  const isUnread = !item.read_at;
  const icon = TYPE_ICON[item.type] ?? { name: 'notifications-outline' as any, color: Colors.primary };

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.75}
    >
      {isUnread && <View style={[styles.unreadBar, { backgroundColor: Colors.primary }]} />}

      <View style={[styles.iconCircle, { backgroundColor: icon.color + '18' }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
      </View>

      {isUnread && <View style={[styles.dot, { backgroundColor: Colors.primary }]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowUnread: {
    backgroundColor: `${Colors.primary}08`,
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 3,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: { flex: 1, gap: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1 },
  titleUnread: { fontWeight: '700' },
  time: { fontSize: 11, color: Colors.textSecondary, flexShrink: 0 },
  body: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});
