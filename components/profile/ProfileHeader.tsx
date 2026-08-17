import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Alert, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

export function ProfileHeader() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const [settingsVisible, setSettingsVisible] = useState(false);

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

            <TouchableOpacity style={styles.sheetRow} onPress={handleSignOut} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#EF444418' }]}>
                <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              </View>
              <Text style={[styles.sheetLabel, { color: Colors.error }]}>Sair da conta</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
  sheetDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },
});
