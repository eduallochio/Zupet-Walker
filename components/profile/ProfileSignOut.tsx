import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

export function ProfileSignOut() {
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () =>
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);

  return (
    <TouchableOpacity style={styles.btn} onPress={handleSignOut} activeOpacity={0.8}>
      <Ionicons name="log-out-outline" size={18} color={Colors.error} />
      <Text style={styles.text}>Sair da conta</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  text: { fontSize: 15, fontWeight: '600', color: Colors.error },
});
