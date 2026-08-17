import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

export function ProfileBio() {
  const router = useRouter();
  const bio = useAuthStore((s) => s.walkerProfile?.bio);

  if (!bio) {
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
      <Text style={styles.bio}>{bio}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  bio: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  emptyCard: {
    marginHorizontal: 20, backgroundColor: Colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  emptyText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
});
