import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

const DASHBOARD_PERFIL_URL = 'https://walker.zupet.io/dashboard/perfil';

export function ProfileWebBanner() {
  const handleOpen = () => {
    Linking.openURL(DASHBOARD_PERFIL_URL).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o navegador.')
    );
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handleOpen} activeOpacity={0.82}>
      <View style={styles.iconWrap}>
        <Ionicons name="globe-outline" size={22} color={Colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Complete seu perfil público</Text>
        <Text style={styles.subtitle}>
          Adicione diferenciais, distância de atendimento, porte aceito e mais — pelo site do walker.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  textWrap: {
    flex: 1,
    gap: 2,
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
});
