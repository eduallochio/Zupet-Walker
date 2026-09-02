import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';

export function ProfileSettingsCard() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/settings' as any)} activeOpacity={0.8}>
        <View style={styles.iconWrap}>
          <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
        </View>
        <Text style={styles.label}>Configurações</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.text },
});
