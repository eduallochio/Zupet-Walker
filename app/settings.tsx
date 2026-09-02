import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { deleteAccount } from '../services/accountService';

export default function SettingsScreen() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Sair da conta',
      'Deseja realmente sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Conta ── */}
        <Text style={styles.sectionLabel}>CONTA</Text>

        <TouchableOpacity style={styles.item} onPress={handleLogout}>
          <View style={[styles.iconWrap, { backgroundColor: '#F4433618' }]}>
            <Ionicons name="log-out-outline" size={20} color="#F44336" />
          </View>
          <Text style={[styles.itemText, { color: '#F44336' }]}>Sair da conta</Text>
          <Ionicons name="chevron-forward" size={18} color="#F4433660" />
        </TouchableOpacity>

        {/* ── Zona de Perigo ── */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>ZONA DE PERIGO</Text>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => setConfirmVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.deleteIconWrap}>
            <Ionicons name="person-remove-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deleteBtnText}>Excluir minha conta</Text>
            <Text style={styles.deleteBtnSub}>Permanente e irreversível</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.dangerNote}>
          Ao excluir sua conta, todos os seus dados de walker (perfil, agenda, histórico e avaliações) serão removidos permanentemente.
        </Text>

      </ScrollView>

      {/* Modal de confirmação de exclusão */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning-outline" size={32} color="#C62828" />
            </View>
            <Text style={styles.modalTitle}>Excluir conta permanentemente?</Text>
            <Text style={styles.modalMsg}>
              Esta ação não pode ser desfeita. Todo o seu perfil de walker, agenda, histórico de passeios e avaliações serão deletados para sempre.
            </Text>
            <TouchableOpacity style={styles.modalDeleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.modalDeleteBtnText}>Excluir permanentemente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmVisible(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Overlay de carregamento */}
      {isDeleting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Excluindo conta...</Text>
            <Text style={styles.loadingSubText}>Isso pode levar alguns segundos</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  scroll: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    color: Colors.textSecondary, marginBottom: 12,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  itemText: { flex: 1, fontSize: 15, fontWeight: '500' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#C62828', borderRadius: 14, padding: 16,
    shadowColor: '#C62828', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  deleteIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  dangerNote: {
    fontSize: 12, color: Colors.textSecondary, marginTop: 10,
    lineHeight: 18, paddingHorizontal: 4,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.card, borderRadius: 20,
    padding: 24, width: '100%', alignItems: 'center', gap: 12,
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  modalMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalDeleteBtn: {
    backgroundColor: '#C62828', borderRadius: 12,
    paddingVertical: 13, width: '100%', alignItems: 'center', marginTop: 4,
  },
  modalDeleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn: { paddingVertical: 10, width: '100%', alignItems: 'center' },
  modalCancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  loadingCard: {
    backgroundColor: Colors.card, borderRadius: 16,
    padding: 28, alignItems: 'center', gap: 12,
  },
  loadingText: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  loadingSubText: { color: Colors.textSecondary, fontSize: 12 },
});
