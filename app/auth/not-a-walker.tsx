import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

export default function NotAWalkerScreen() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const isTutor = useAuthStore((s) => s.isTutor);

  const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? '';

  const handleBecomeWalker = () => {
    router.replace('/onboarding/walker-profile');
  };

  const handleOpenZupet = () => {
    Linking.openURL('zupet://').catch(() => {
      Linking.openURL('https://zupet.io');
    });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="paw-outline" size={48} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Este app é para Walkers</Text>
        <Text style={styles.subtitle}>
          Olá{name ? `, ${name.split(' ')[0]}` : ''}! A conta{'\n'}
          <Text style={styles.email}>{user?.email}</Text>
          {'\n'}não tem perfil de walker cadastrado.
        </Text>

        {isTutor && (
          <View style={styles.tutorCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.cardText}>
              Você já tem uma conta de <Text style={styles.bold}>tutor</Text> no Zupet com este e-mail.
              Pode usar os dois perfis com a mesma conta.
            </Text>
          </View>
        )}

        {!isTutor && (
          <View style={styles.card}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.cardText}>
              O <Text style={styles.bold}>Zupet Walker</Text> é exclusivo para profissionais que oferecem serviços de passeio.{' '}
              Se você é tutor, use o app <Text style={styles.bold}>Zupet</Text>.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={handleBecomeWalker} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Quero ser Walker</Text>
        </TouchableOpacity>

        {isTutor && (
          <TouchableOpacity style={styles.tutorBtn} onPress={handleOpenZupet} activeOpacity={0.85}>
            <Ionicons name="phone-portrait-outline" size={18} color={Colors.primary} />
            <Text style={styles.tutorBtnText}>Abrir o Zupet (tutor)</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.secondaryBtnText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, gap: 20,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: Colors.text,
    textAlign: 'center', letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  email: { fontWeight: '700', color: Colors.text },
  card: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, width: '100%',
  },
  cardText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  bold: { fontWeight: '700', color: Colors.text },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    height: 52, paddingHorizontal: 28, justifyContent: 'center',
    width: '100%', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tutorCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: `${Colors.primary}12`, borderRadius: 14,
    borderWidth: 1, borderColor: `${Colors.primary}30`,
    padding: 14, width: '100%',
  },
  tutorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, height: 52, paddingHorizontal: 28,
    justifyContent: 'center', width: '100%',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  tutorBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, height: 48, paddingHorizontal: 28,
    justifyContent: 'center', width: '100%',
    borderWidth: 1.5, borderColor: `${Colors.error}40`,
  },
  secondaryBtnText: { color: Colors.error, fontSize: 15, fontWeight: '600' },
});
