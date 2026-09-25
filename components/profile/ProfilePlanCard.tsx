import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Linking, Alert, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { purchasePro, restorePurchases, syncPlanWithSupabase } from '../../services/iapService';

const DASHBOARD_URL = 'https://walker.zupet.io';

export function ProfilePlanCard() {
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const setWalkerProfile = useAuthStore((s) => s.setWalkerProfile);
  const plan  = walkerProfile?.plan ?? 'free';
  const isPro = plan === 'pro';
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isPro) return null;

  const handlePurchase = async () => {
    setLoading(true);
    const result = await purchasePro();
    setLoading(false);
    if (result.success) {
      if (walkerProfile) {
        await syncPlanWithSupabase(walkerProfile.id, true);
        setWalkerProfile({ ...walkerProfile, plan: 'pro' });
      }
      setModalVisible(false);
      Alert.alert('Plano Pro ativado!', 'Bem-vindo ao Plano Pro. Seus recursos foram desbloqueados.');
    } else if (result.error) {
      Alert.alert('Erro', result.error);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const active = await restorePurchases();
    setLoading(false);
    if (active) {
      if (walkerProfile) {
        await syncPlanWithSupabase(walkerProfile.id, true);
        setWalkerProfile({ ...walkerProfile, plan: 'pro' });
      }
      setModalVisible(false);
      Alert.alert('Compra restaurada!', 'Seu Plano Pro foi restaurado com sucesso.');
    } else {
      Alert.alert('Nenhuma assinatura encontrada', 'Não encontramos uma assinatura ativa para restaurar.');
    }
  };

  const handleOpenDashboard = () => {
    setModalVisible(false);
    setTimeout(() => {
      Linking.openURL(DASHBOARD_URL).catch(() =>
        Alert.alert('Erro', 'Não foi possível abrir o navegador.')
      );
    }, 300);
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setModalVisible(true)}>
        <View style={styles.cardLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="star-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.title}>Plano Gratuito</Text>
            <Text style={styles.sub}>Assine o Pro para recursos ilimitados</Text>
          </View>
        </View>
        <View style={styles.proBtn}>
          <Text style={styles.proBtnText}>Pro +</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => { if (!loading) setModalVisible(false); }}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetIconWrap}>
              <Ionicons name="star" size={32} color="#F59E0B" />
            </View>

            <Text style={styles.sheetTitle}>Plano Pro</Text>

            <View style={styles.benefitsList}>
              {[
                'Pets ilimitados vinculados',
                'Serviços ilimitados',
                'Histórico completo de passeios',
                'Sem limite de pets por passeio',
              ].map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            {Platform.OS === 'ios' ? (
              <>
                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
                  onPress={handlePurchase}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={16} color="#fff" />
                      <Text style={styles.confirmBtnText}>Assinar via App Store</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.restoreBtn}
                  onPress={handleRestore}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={styles.restoreBtnText}>Restaurar compra</Text>
                </TouchableOpacity>

                <Text style={styles.legalText}>
                  A assinatura é cobrada pela Apple. Cancele a qualquer momento nas configurações da App Store.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.sheetDesc}>
                  A assinatura é feita pelo{' '}
                  <Text style={styles.sheetBold}>Dashboard exclusivo do Walker</Text>
                  {' '}no site.
                </Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleOpenDashboard} activeOpacity={0.85}>
                  <Ionicons name="open-outline" size={16} color="#fff" />
                  <Text style={styles.confirmBtnText}>Ir para o Dashboard</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7} disabled={loading}>
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

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
    alignItems: 'center', gap: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 4 },
  sheetIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  sheetDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  sheetBold: { fontWeight: '700', color: Colors.text },

  benefitsList: { width: '100%', gap: 8, paddingVertical: 4 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { fontSize: 14, color: Colors.text },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    height: 50, paddingHorizontal: 24, justifyContent: 'center', width: '100%',
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  restoreBtn: { paddingVertical: 6 },
  restoreBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  legalText: {
    fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16,
    paddingHorizontal: 8,
  },

  cancelBtn: { paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
});
