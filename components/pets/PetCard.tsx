import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { LinkedPet, PetStatus } from '../../types/walker';

const STATUS_LABEL: Record<PetStatus, string> = { pending: 'Pendente', active: 'Ativo', inactive: 'Inativo' };
const STATUS_COLOR: Record<PetStatus, string> = { pending: Colors.warning, active: Colors.success, inactive: Colors.textSecondary };

type Props = { item: LinkedPet; onPress: (item: LinkedPet) => void; onUnlink?: (item: LinkedPet) => void };

export function PetCard({ item, onPress, onUnlink }: Props) {
  const color = STATUS_COLOR[item.status];
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={styles.avatar}>
        {item.pet?.photo_uri ? (
          <Image source={{ uri: item.pet.photo_uri }} style={styles.avatarImg} />
        ) : (
          <Ionicons name="paw" size={22} color={Colors.primary} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.name}>{item.pet?.name ?? '—'}</Text>
          <View style={[styles.statusChip, { backgroundColor: `${color}20` }]}>
            <Text style={[styles.statusText, { color }]}>{STATUS_LABEL[item.status]}</Text>
          </View>
        </View>
        <Text style={styles.breed}>{item.pet?.breed ?? 'Raça não informada'}</Text>
        <View style={styles.ownerRow}>
          <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.ownerName}>{item.owner?.name ?? '—'}</Text>
        </View>
      </View>
      {onUnlink ? (
        <TouchableOpacity
          style={styles.unlinkBtn}
          onPress={() => onUnlink(item)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="unlink-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Colors.border} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 46, height: 46 },
  body: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  statusChip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  breed: { fontSize: 12, color: Colors.textSecondary },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerName: { fontSize: 12, color: Colors.textSecondary },
  unlinkBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.error}12`,
    justifyContent: 'center', alignItems: 'center',
  },
});
