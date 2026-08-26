import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

const SIZE_LABELS: Record<string, string> = {
  small: 'Pequeno (1–5kg)',
  medium: 'Médio (5–15kg)',
  large: 'Grande (15–30kg)',
  xlarge: 'Gigante (30+kg)',
};

export function ProfileBio() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.walkerProfile);
  const bio = profile?.bio;
  const summaryItems = profile?.summary_items ?? [];
  const acceptedSizes = profile?.accepted_sizes ?? [];
  const acceptsLastMinute = profile?.accepts_last_minute ?? false;
  const maxDistanceKm = profile?.service_radius_km;

  const hasContent = bio || summaryItems.length > 0 || maxDistanceKm || acceptedSizes.length > 0 || acceptsLastMinute;

  if (!hasContent) {
    return (
      <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/profile/edit')} activeOpacity={0.8}>
        <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>Adicione uma bio para se apresentar aos tutores</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.border} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Sobre mim</Text>

      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {summaryItems.length > 0 && (
        <View style={styles.summaryList}>
          {summaryItems.map((item, i) => (
            <View key={i} style={styles.summaryRow}>
              <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />
              <Text style={styles.summaryText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Badges: distância, porte, última hora */}
      {(maxDistanceKm || acceptedSizes.length > 0 || acceptsLastMinute) && (
        <View style={styles.badgesRow}>
          {maxDistanceKm ? (
            <View style={styles.badge}>
              <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
              <Text style={styles.badgeText}>Até {maxDistanceKm}km</Text>
            </View>
          ) : null}
          {acceptedSizes.length > 0 && acceptedSizes.length < 4 && (
            <View style={styles.badge}>
              <Ionicons name="paw-outline" size={12} color={Colors.primary} />
              <Text style={styles.badgeText}>{acceptedSizes.map(s => SIZE_LABELS[s]?.split(' ')[0] ?? s).join(' · ')}</Text>
            </View>
          )}
          {acceptsLastMinute && (
            <View style={[styles.badge, styles.badgeYellow]}>
              <Ionicons name="flash-outline" size={12} color="#D97706" />
              <Text style={[styles.badgeText, { color: '#D97706' }]}>Aceita última hora</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  bio: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  summaryList: { gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  summaryText: { fontSize: 13, color: Colors.text, lineHeight: 19, flex: 1 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${Colors.primary}12`,
    borderWidth: 1, borderColor: `${Colors.primary}25`,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeYellow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  emptyCard: {
    marginHorizontal: 20, backgroundColor: Colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  emptyText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
});
