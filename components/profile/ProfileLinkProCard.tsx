import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

const BASE_URL = 'https://walker.zupet.io/w';

export function ProfileLinkProCard() {
  const profile = useAuthStore((s) => s.walkerProfile);
  const isPro   = profile?.plan === 'pro';
  const username = (profile as any)?.username as string | null | undefined;

  if (!isPro) return null;

  const profileUrl = username ? `${BASE_URL}/${username}` : null;

  const handleShare = async () => {
    if (!profileUrl) return;
    try {
      await Share.share({ message: `Confira meu perfil de walker no Zupet: ${profileUrl}`, url: profileUrl });
    } catch {}
  };

  const handleOpenProfile = () => {
    if (!profileUrl) return;
    Linking.openURL(profileUrl).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o link.')
    );
  };

  const handleSetUsername = () => {
    Linking.openURL('zupet-walker://profile/edit').catch(() => {});
  };

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="link-outline" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Seu link público</Text>
            <Text style={styles.subtitle}>Exclusivo para walkers Pro</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⭐ Pro</Text>
          </View>
        </View>

        {profileUrl ? (
          <>
            <TouchableOpacity style={styles.linkBox} onPress={handleOpenProfile} activeOpacity={0.7}>
              <Text style={styles.linkText} numberOfLines={1}>{profileUrl}</Text>
              <Ionicons name="open-outline" size={14} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>Compartilhar perfil</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.noUsernameText}>
              Configure um username para ativar seu link personalizado.
            </Text>
            <TouchableOpacity style={styles.shareBtn} onPress={handleSetUsername} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>Definir meu username</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.textSecondary },
  badge: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  linkBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  linkText: { flex: 1, fontSize: 13, color: Colors.primary, fontWeight: '600' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12, paddingVertical: 12,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  noUsernameText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
});
