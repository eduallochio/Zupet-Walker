import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Share, Clipboard, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type OwnPet = {
  id: string;
  name: string;
  breed: string | null;
  species: string | null;
  gender: string | null;
  pet_link_code: string | null;
};

type Props = {
  pet: OwnPet | null;
  onClose: () => void;
};

export function OwnPetModal({ pet, onClose }: Props) {
  if (!pet) return null;

  const isMerged = !pet.pet_link_code;

  const copyCode = () => {
    if (!pet.pet_link_code) return;
    Clipboard.setString(pet.pet_link_code);
    Alert.alert('Copiado!', 'Código copiado para a área de transferência.');
  };

  const shareCode = () => {
    if (!pet.pet_link_code) return;
    Share.share({
      message: `Use o código *${pet.pet_link_code}* no app Zupet (tutor) para vincular ${pet.name} à conta dele.`,
    });
  };

  const speciesLabel = () => {
    if (pet.species === 'dog') return 'Cão';
    if (pet.species === 'cat') return 'Gato';
    return pet.species ?? '—';
  };

  return (
    <Modal visible={!!pet} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.petIcon}>
              <Ionicons name="paw" size={28} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petMeta}>
            {[speciesLabel(), pet.breed, pet.gender === 'male' ? 'Macho' : pet.gender === 'female' ? 'Fêmea' : null]
              .filter(Boolean).join(' · ')}
          </Text>

          <View style={styles.divider} />

          {isMerged ? (
            <View style={styles.mergedBox}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              <Text style={styles.mergedTitle}>Vinculado ao tutor</Text>
              <Text style={styles.mergedSub}>
                O tutor já importou os dados de {pet.name}. Os registros estão associados.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.codeLabel}>CÓDIGO DE VÍNCULO</Text>
              <Text style={styles.codeValue}>{pet.pet_link_code}</Text>
              <Text style={styles.codeSub}>
                Compartilhe com o tutor para vincular {pet.name} à conta dele no Zupet
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={copyCode} activeOpacity={0.8}>
                  <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                  <Text style={styles.actionBtnText}>Copiar</Text>
                </TouchableOpacity>
                <View style={styles.actionDivider} />
                <TouchableOpacity style={styles.actionBtn} onPress={shareCode} activeOpacity={0.8}>
                  <Ionicons name="share-social-outline" size={20} color={Colors.primary} />
                  <Text style={styles.actionBtnText}>Compartilhar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', backgroundColor: Colors.background,
    borderRadius: 24, padding: 24, alignItems: 'center', gap: 8,
  },
  header: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  petIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: { padding: 4 },
  petName: { fontSize: 24, fontWeight: '800', color: Colors.text, alignSelf: 'flex-start' },
  petMeta: { fontSize: 13, color: Colors.textSecondary, alignSelf: 'flex-start' },
  divider: { width: '100%', height: 1, backgroundColor: Colors.border, marginVertical: 8 },

  codeLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 1.2, marginTop: 4,
  },
  codeValue: {
    fontSize: 40, fontWeight: '900', color: Colors.primary,
    letterSpacing: 8, marginVertical: 4,
  },
  codeSub: {
    fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18,
  },
  actions: {
    flexDirection: 'row', width: '100%', marginTop: 8,
    backgroundColor: Colors.card, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 14,
  },
  actionDivider: { width: 1, backgroundColor: Colors.border },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },

  mergedBox: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  mergedTitle: { fontSize: 18, fontWeight: '800', color: '#4CAF50' },
  mergedSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
