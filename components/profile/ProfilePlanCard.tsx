import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

export function ProfilePlanCard() {
  const plan  = useAuthStore((s) => s.walkerProfile?.plan ?? 'free');
  const isPro = plan === 'pro';

  if (isPro) return null;

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.left}>
          <Text style={styles.title}>Plano Gratuito</Text>
          <Text style={styles.sub}>Faça upgrade para recursos ilimitados</Text>
        </View>
        <TouchableOpacity
          style={styles.proBtn}
          activeOpacity={0.8}
          onPress={() => Linking.openURL('https://instagram.com/zupet.io').catch(() => {})}
        >
          <Text style={styles.proBtnText}>Pro +</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border,
  },
  left: { gap: 3 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 12, color: Colors.textSecondary },
  proBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  proBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
