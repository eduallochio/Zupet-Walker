import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

export function ProfileSettings() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSignOut = () =>
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CONFIGURAÇÕES</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/profile/edit')} activeOpacity={0.7}>
          <View style={[styles.iconWrap, { backgroundColor: `${Colors.primary}18` }]}>
            <Ionicons name="person-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Editar perfil</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={[styles.row, styles.rowNoPress]}>
          <View style={[styles.iconWrap, { backgroundColor: `${Colors.textSecondary}18` }]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          </View>
          <Text style={styles.rowLabel}>Versão do app</Text>
          <Text style={styles.versionText}>{appVersion}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
          <View style={[styles.iconWrap, { backgroundColor: '#EF444418' }]}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          </View>
          <Text style={[styles.rowLabel, { color: Colors.error }]}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 0.8, marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },
  rowNoPress: {},
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  versionText: { fontSize: 13, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 60 },
});
