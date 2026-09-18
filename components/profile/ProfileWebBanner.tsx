import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

const BASE_URL = 'https://walker.zupet.io';

export function ProfileWebBanner() {
  const profile  = useAuthStore((s) => s.walkerProfile);
  const username = profile?.username;
  const profileUrl = username ? `${BASE_URL}/w/${username}` : null;

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o navegador.')
    );
  };

  const handleShare = async () => {
    if (!profileUrl) return;
    try {
      await Share.share({
        message: `Confira meu perfil de walker no Zupet: ${profileUrl}`,
        url: profileUrl,
      });
    } catch {}
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="globe-outline" size={22} color={Colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Seu perfil na web</Text>
        </View>
        <Text style={styles.subtitle}>
          Acesse e compartilhe seu perfil público ou complete seus dados pelo painel.
        </Text>

        {profileUrl && (
          <TouchableOpacity style={styles.linkBox} onPress={() => openUrl(profileUrl)} activeOpacity={0.7}>
            <Text style={styles.linkText} numberOfLines={1}>{profileUrl}</Text>
            <Ionicons name="open-outline" size={13} color={Colors.primary} />
          </TouchableOpacity>
        )}

        <View style={styles.btns}>
          {profileUrl ? (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => openUrl(profileUrl)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Ver perfil</Text>
            </TouchableOpacity>
          ) : null}

          {profileUrl && (
            <TouchableOpacity
              style={styles.btnShare}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social-outline" size={14} color={Colors.primary} />
              <Text style={styles.btnShareText}>Compartilhar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => openUrl(`${BASE_URL}/dashboard/perfil`)}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={14} color={Colors.primary} />
            <Text style={styles.btnSecondaryText}>Editar no painel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#E6FAF7',
    borderWidth: 1,
    borderColor: '#B2EDE5',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D2926',
  },
  subtitle: {
    fontSize: 12,
    color: '#3D8A7A',
    lineHeight: 17,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#B2EDE5',
    marginTop: 6,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  btns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
  },
  btnShareText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B2EDE5',
  },
  btnSecondaryText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});
