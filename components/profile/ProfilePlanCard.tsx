import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Linking, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

const DASHBOARD_URL = 'https://walker.zupet.io';

export function ProfilePlanCard() {
  const plan  = useAuthStore((s) => s.walkerProfile?.plan ?? 'free');
  const isPro = plan === 'pro';
  const [modalVisible, setModalVisible] = useState(false);

  if (isPro) return null;

  const handleOpenDashboard = () => {
    setModalVisible(false);
    setTimeout(() => {
      Linking.openURL(DASHBOARD_URL).catch(() =>
        Alert.alert('Erro', 'Não foi possível abrir o navegador.')
      );
    }, 300);
  };

  if (Platform.OS === 'ios') {
    return null;
  }

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setModalVisible(true)}>
        <View style={styles.cardLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="star-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.title}>Plano Gratuito</Text>
            <Text style={styles.sub}>Faça upgrade para recursos ilimitados</Text>
          </View>
        </View>
        <View style={styles.proBtn}>
          <Text style={styles.proBtnText}>Pro +</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetIconWrap}>
              <Ionicons name="star" size={32} color="#F59E0B" />
            </View>

            <Text style={styles.sheetTitle}>Assine o Plano Pro</Text>
            <Text style={styles.sheetDesc}>
              A assinatura é feita pelo{' '}
              <Text style={styles.sheetBold}>Dashboard exclusivo do Walker</Text>
              {' '}no site. Você será redirecionado para{' '}
              <Text style={styles.sheetUrl}>walker.zupet.io</Text>
            </Text>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>
                Use o <Text style={styles.sheetBold}>mesmo e-mail e senha</Text> do app para fazer login no site.
              </Text>
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleOpenDashboard} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text style={styles.confirmBtnText}>Ir para o Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Agora não</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  cardText: { gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 12, color: Colors.textSecondary },
  proBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  proBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
    alignItems: 'center', gap: 16,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 8,
  },
  sheetIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#F59E0B18',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  sheetDesc: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21,
  },
  sheetBold: { fontWeight: '700', color: Colors.text },
  sheetUrl: { fontWeight: '600', color: Colors.primary },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${Colors.primary}10`, borderRadius: 12,
    borderWidth: 1, borderColor: `${Colors.primary}25`,
    padding: 12, width: '100%',
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    height: 50, paddingHorizontal: 24, justifyContent: 'center', width: '100%',
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
});
