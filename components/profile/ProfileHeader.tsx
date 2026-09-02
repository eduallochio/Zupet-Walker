import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Alert, Pressable, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { deleteAccount } from '../../services/accountService';

export function ProfileHeader() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const userEmail = useAuthStore((s) => s.session?.user?.email ?? null);
  const signOut = useAuthStore((s) => s.signOut);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const navigate = (path: string) => {
    setSettingsVisible(false);
    setTimeout(() => router.push(path as any), 200);
  };

  const handleSignOut = () => {
    setSettingsVisible(false);
    setTimeout(() => {
      Alert.alert('Sair', 'Tem certeza que deseja sair?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: signOut },
      ]);
    }, 300);
  };

  const handleDeleteAccount = async () => {
    setConfirmVisible(false);
    setIsDeleting(true);
    const result = await deleteAccount();
    setIsDeleting(false);
    if (result.success) {
      router.replace('/auth/login' as any);
    } else {
      Alert.alert('Erro', result.error);
    }
  };

  const handleSupport = () => {
    setSettingsVisible(false);
    Linking.openURL('https://instagram.com/zupet.io').catch(() => {});
  };

  const handleNotifications = () => {
    setSettingsVisible(false);
    Linking.openSettings().catch(() => {});
  };

  const name    = walkerProfile?.name ?? 'Walker';
  const city    = walkerProfile?.city ?? '';
  const state   = (walkerProfile as any)?.state ?? '';
  const plan    = walkerProfile?.plan ?? 'free';
  const rating  = walkerProfile?.rating;
  const isPro   = plan === 'pro';
  const location = [city, state].filter(Boolean).join(', ');

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.connectBtn} onPress={() => router.push('/walker-connect')}>
        <Ionicons name="link-outline" size={16} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>
      <View style={styles.rightBtns}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/profile/edit')}>
          <Ionicons name="pencil" size={16} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsVisible(true)}>
          <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* Modal de configurações */}
      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setSettingsVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Configurações</Text>

            <TouchableOpacity style={styles.sheetRow} onPress={() => navigate('/profile/edit')} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: `${Colors.primary}18` }]}>
                <Ionicons name="person-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.sheetLabel}>Editar perfil</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetRow} onPress={() => navigate('/services')} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#10B98118' }]}>
                <Ionicons name="calendar-outline" size={18} color="#10B981" />
              </View>
              <Text style={styles.sheetLabel}>Disponibilidade</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetRow} onPress={() => navigate('/services')} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#F59E0B18' }]}>
                <Ionicons name="briefcase-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.sheetLabel}>Meus serviços</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetRow} onPress={handleNotifications} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#6366F118' }]}>
                <Ionicons name="notifications-outline" size={18} color="#6366F1" />
              </View>
              <Text style={styles.sheetLabel}>Notificações</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetRow} onPress={handleSupport} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#E1306C18' }]}>
                <Ionicons name="logo-instagram" size={18} color="#E1306C" />
              </View>
              <Text style={styles.sheetLabel}>Suporte</Text>
              <Text style={styles.sheetVersion}>@zupet.io</Text>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <View style={styles.sheetRow}>
              <View style={[styles.sheetIcon, { backgroundColor: `${Colors.textSecondary}18` }]}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
              </View>
              <Text style={styles.sheetLabel}>Versão do app</Text>
              <Text style={styles.sheetVersion}>{appVersion}</Text>
            </View>

            <View style={styles.sheetDivider} />

            {userEmail && (
              <>
                <View style={styles.sheetRow}>
                  <View style={[styles.sheetIcon, { backgroundColor: `${Colors.primary}18` }]}>
                    <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetLabel}>Conta</Text>
                    <Text style={styles.sheetEmail} numberOfLines={1}>{userEmail}</Text>
                  </View>
                </View>
                <View style={styles.sheetDivider} />
              </>
            )}

            <TouchableOpacity style={styles.sheetRow} onPress={handleSignOut} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#EF444418' }]}>
                <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              </View>
              <Text style={[styles.sheetLabel, { color: Colors.error }]}>Sair da conta</Text>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetRow} onPress={() => { setSettingsVisible(false); setTimeout(() => setConfirmVisible(true), 300); }} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#C6282818' }]}>
                <Ionicons name="person-remove-outline" size={18} color="#C62828" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetLabel, { color: '#C62828' }]}>Excluir minha conta</Text>
                <Text style={styles.sheetVersion}>Permanente e irreversível</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="warning-outline" size={30} color="#C62828" />
            </View>
            <Text style={styles.confirmTitle}>Excluir conta permanentemente?</Text>
            <Text style={styles.confirmMsg}>
              Esta ação não pode ser desfeita. Todo o seu perfil de walker, agenda, histórico de passeios e avaliações serão deletados para sempre.
            </Text>
            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.confirmDeleteText}>Excluir permanentemente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmVisible(false)}>
              <Text style={styles.confirmCancelText}>Cancelar</Text>
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

      <TouchableOpacity onPress={() => router.push('/profile/edit')} style={styles.avatarWrap}>
        {walkerProfile?.avatar_url ? (
          <Image source={{ uri: walkerProfile.avatar_url }} style={styles.avatarImg} />
        ) : (
          <Ionicons name="person" size={36} color="#fff" />
        )}
      </TouchableOpacity>

      <Text style={styles.name}>{name}</Text>

      {rating != null && (
        <View style={styles.ratingRow}>
          {[1,2,3,4,5].map((s) => (
            <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={14} color="#FFD700" />
          ))}
          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
        </View>
      )}

      <View style={styles.chipsRow}>
        {location ? (
          <View style={styles.chip}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.chipText}>{location}</Text>
          </View>
        ) : null}
        <View style={styles.chip}>
          <Ionicons name={isPro ? 'star' : 'star-outline'} size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.chipText}>Plano {isPro ? 'Pro' : 'Gratuito'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary, paddingTop: 28, paddingBottom: 28,
    alignItems: 'center', gap: 10,
  },
  connectBtn: {
    position: 'absolute', top: 12, left: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 8,
  },
  rightBtns: {
    position: 'absolute', top: 12, right: 16,
    flexDirection: 'row', gap: 8,
  },
  iconBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 8,
  },
  avatarWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarImg: { width: 84, height: 84, borderRadius: 42 },
  name: { fontSize: 20, fontWeight: '800', color: '#fff' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginLeft: 4 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  // Settings modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 36, paddingTop: 12, paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.text,
    marginBottom: 16,
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  sheetIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  sheetVersion: { fontSize: 13, color: Colors.textSecondary },
  sheetEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  sheetDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },

  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  confirmCard: {
    backgroundColor: Colors.card, borderRadius: 20,
    padding: 24, width: '100%', alignItems: 'center', gap: 10,
  },
  confirmIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center',
  },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  confirmMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  confirmDeleteBtn: {
    backgroundColor: '#C62828', borderRadius: 12,
    paddingVertical: 12, width: '100%', alignItems: 'center', marginTop: 6,
  },
  confirmDeleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  confirmCancelBtn: { paddingVertical: 8, width: '100%', alignItems: 'center' },
  confirmCancelText: { color: Colors.textSecondary, fontSize: 14 },

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
