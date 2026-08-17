import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Clipboard } from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';

const SPECIES = ['Cão', 'Gato', 'Outro'];
const GENDERS = ['Macho', 'Fêmea'];

export default function AddPetScreen() {
  const router = useRouter();

  const [name, setName]         = useState('');
  const [species, setSpecies]   = useState('Cão');
  const [breed, setBreed]       = useState('');
  const [gender, setGender]     = useState('Macho');
  const [castrated, setCastrated] = useState(false);
  const [dob, setDob]           = useState('');
  const [weight, setWeight]     = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const formatDob = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const uploadPhoto = async (uri: string, petId: string): Promise<string | null> => {
    try {
      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `walker-pets/${petId}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from('pet-photos').upload(path, blob, {
        contentType: `image/${ext}`, upsert: true,
      });
      if (error) return null;
      const { data } = supabase.storage.from('pet-photos').getPublicUrl(path);
      return data.publicUrl;
    } catch { return null; }
  };

  const generateLinkCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part(3)}-${part(4)}`;
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert('Informe o nome do pet.'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const petId = `walker_${user.id}_${Date.now()}`;
      const code = generateLinkCode();

      let uploadedPhotoUrl: string | null = null;
      if (photoUri) uploadedPhotoUrl = await uploadPhoto(photoUri, petId);

      const { error } = await supabase.from('pets').insert({
        id: petId,
        user_id: user.id,
        walker_owner_id: user.id,
        pet_link_code: code,
        is_memorial: false,
        name: name.trim(),
        species: species.toLowerCase() === 'cão' ? 'dog' : species.toLowerCase() === 'gato' ? 'cat' : 'other',
        breed: breed.trim() || null,
        gender: gender === 'Macho' ? 'male' : 'female',
        castrated,
        dob: dob || null,
        weight: weight ? parseFloat(weight.replace(',', '.')) : null,
        restrictions: restrictions.trim() || null,
        photo_uri: uploadedPhotoUrl ?? photoUri,
      });

      if (error) throw error;

      setLinkCode(code);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar o pet.');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    if (!linkCode) return;
    Clipboard.setString(linkCode);
    Alert.alert('Copiado!', 'Código copiado para a área de transferência.');
  };

  const shareCode = async () => {
    if (!linkCode) return;
    await Share.share({
      message: `Use o código *${linkCode}* no app Zupet (tutor) para vincular ${name.trim()} à sua conta.`,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{linkCode ? 'Pet cadastrado!' : 'Cadastrar Pet'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tela de sucesso com o código */}
      {linkCode ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>{name.trim()} cadastrado!</Text>
          <Text style={styles.successSub}>
            Compartilhe o código abaixo com o tutor para que ele possa vincular o pet à conta do Zupet.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>CÓDIGO DE VÍNCULO</Text>
            <Text style={styles.codeValue}>{linkCode}</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.codeBtn} onPress={copyCode} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                <Text style={styles.codeBtnText}>Copiar</Text>
              </TouchableOpacity>
              <View style={styles.codeDivider} />
              <TouchableOpacity style={styles.codeBtn} onPress={shareCode} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={18} color={Colors.primary} />
                <Text style={styles.codeBtnText}>Compartilhar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>
              O tutor digita este código em "Adicionar pet" no app Zupet. Os dados são importados automaticamente e os registros são associados.
            </Text>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Voltar para meus pets</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Foto */}
        <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={32} color={Colors.textSecondary} />
              <Text style={styles.photoText}>Adicionar foto</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Nome */}
        <View style={styles.field}>
          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do pet"
            placeholderTextColor={Colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Espécie */}
        <View style={styles.field}>
          <Text style={styles.label}>Espécie</Text>
          <View style={styles.chips}>
            {SPECIES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, species === s && styles.chipActive]}
                onPress={() => setSpecies(s)}
              >
                <Text style={[styles.chipText, species === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Raça */}
        <View style={styles.field}>
          <Text style={styles.label}>Raça</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Labrador, Persa..."
            placeholderTextColor={Colors.textSecondary}
            value={breed}
            onChangeText={setBreed}
          />
        </View>

        {/* Gênero */}
        <View style={styles.field}>
          <Text style={styles.label}>Gênero</Text>
          <View style={styles.chips}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, gender === g && styles.chipActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Castrado */}
        <TouchableOpacity style={styles.toggle} onPress={() => setCastrated((v) => !v)} activeOpacity={0.8}>
          <View style={[styles.toggleBox, castrated && styles.toggleBoxActive]}>
            {castrated && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.toggleLabel}>Castrado / Castrada</Text>
        </TouchableOpacity>

        {/* Data de nascimento */}
        <View style={styles.field}>
          <Text style={styles.label}>Data de nascimento</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.textSecondary}
            value={dob}
            onChangeText={(t) => setDob(formatDob(t))}
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        {/* Peso */}
        <View style={styles.field}>
          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 12,5"
            placeholderTextColor={Colors.textSecondary}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Restrições */}
        <View style={styles.field}>
          <Text style={styles.label}>Restrições / Observações</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Alergias, comportamento, cuidados especiais..."
            placeholderTextColor={Colors.textSecondary}
            value={restrictions}
            onChangeText={setRestrictions}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>
            Este pet fica vinculado à sua conta. Se o tutor criar uma conta no Zupet, você poderá associar os registros ao se vincular.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Cadastrar pet</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },

  photoPicker: { alignSelf: 'center', marginBottom: 4 },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoText: { fontSize: 11, color: Colors.textSecondary },

  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text,
  },
  inputMultiline: { height: 88, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBoxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },

  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: `${Colors.primary}12`, borderRadius: 12, padding: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Tela de sucesso
  successIcon: { alignItems: 'center', marginBottom: 8, marginTop: 8 },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  successSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  codeBox: {
    backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1.5,
    borderColor: Colors.primary, overflow: 'hidden', alignItems: 'center', paddingTop: 20, paddingBottom: 0,
  },
  codeLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  codeValue: { fontSize: 36, fontWeight: '900', color: Colors.primary, letterSpacing: 6, marginBottom: 16 },
  codeActions: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: Colors.border },
  codeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  codeDivider: { width: 1, backgroundColor: Colors.border },
  codeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
