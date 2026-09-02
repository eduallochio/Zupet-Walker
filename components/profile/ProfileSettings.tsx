import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { deleteAccount } from '../../services/accountService';

export function ProfileSettings() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSignOut = () =>
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);

  const handleDeleteAccount = async () => {
    setConfirmVisible(false);
    setIsDeleting(true);
    const result = await deleteAccount();
    setIsDeleting(false);
    if (result.success) {
      router.replace('/auth/login');
    } else {
      Alert.alert('Erro', result.error);
    }
  };

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

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={() => setConfirmVisible(true)} activeOpacity={0.7}>
          <View style={[styles.iconWrap, { backgroundColor: '#C6282818' }]}>
            <Ionicons name="person-remove-outline" size={18} color="#C62828" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: '#C62828' }]}>Excluir minha conta</Text>
            <Text style={styles.rowSub}>Permanente e irreversível</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal de confirmação */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning-outline" size={30} color="#C62828" />
            </View>
            <Text style={styles.modalTitle}>Excluir conta permanentemente?</Text>
            <Text style={styles.modalMsg}>
              Esta ação não pode ser desfeita. Todo o seu perfil de walker, agenda, histórico de passeios e avaliações serão deletados para sempre.
            </Text>
            <TouchableOpacity style={styles.modalDeleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.modalDeleteText}>Excluir permanentemente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmVisible(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading overlay */}
      {isDeleting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Excluindo conta...</Text>
          </View>
        </View>
      )}
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
  rowSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  versionText: { fontSize: 13, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 60 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.card, borderRadius: 20,
    padding: 24, width: '100%', alignItems: 'center', gap: 10,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  modalMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalDeleteBtn: {
    backgroundColor: '#C62828', borderRadius: 12,
    paddingVertical: 12, width: '100%', alignItems: 'center', marginTop: 6,
  },
  modalDeleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalCancelBtn: { paddingVertical: 8, width: '100%', alignItems: 'center' },
  modalCancelText: { color: Colors.textSecondary, fontSize: 14 },

  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', zIndex: 99,
  },
  loadingCard: {
    backgroundColor: Colors.card, borderRadius: 16,
    padding: 24, alignItems: 'center', gap: 12,
  },
  loadingText: { color: Colors.text, fontWeight: '600', fontSize: 14 },
});
