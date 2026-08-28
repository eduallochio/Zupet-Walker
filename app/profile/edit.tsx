import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const walkerProfile    = useAuthStore((s) => s.walkerProfile);
  const setWalkerProfile = useAuthStore((s) => s.setWalkerProfile);

  // Informações básicas
  const [name, setName]   = useState(walkerProfile?.name ?? '');
  const [phone, setPhone] = useState(walkerProfile?.phone ?? '');
  const [cpf, setCpf]     = useState(walkerProfile?.cpf ?? '');
  const [bio, setBio]     = useState(walkerProfile?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string>(walkerProfile?.avatar_url ?? '');

  // Endereço
  const [cep, setCep]               = useState((walkerProfile as any)?.cep ?? '');
  const [street, setStreet]         = useState((walkerProfile as any)?.street ?? '');
  const [number, setNumber]         = useState((walkerProfile as any)?.number ?? '');
  const [complement, setComplement] = useState((walkerProfile as any)?.complement ?? '');
  const [neighborhood, setNeighborhood] = useState((walkerProfile as any)?.neighborhood ?? '');
  const [city, setCity]             = useState(walkerProfile?.city ?? '');
  const [state, setState]           = useState((walkerProfile as any)?.state ?? '');

  const [radiusKm, setRadius] = useState(walkerProfile?.service_radius_km?.toString() ?? '5');

  // Redes sociais
  const socialRaw = (walkerProfile as any)?.social_links ?? {};
  const [instagram, setInstagram] = useState<string>(socialRaw.instagram ?? '');
  const [tiktok, setTiktok]       = useState<string>(socialRaw.tiktok ?? '');
  const [youtube, setYoutube]     = useState<string>(socialRaw.youtube ?? '');
  const [linkedin, setLinkedin]   = useState<string>(socialRaw.linkedin ?? '');
  const [whatsapp, setWhatsapp]   = useState<string>(socialRaw.whatsapp ?? '');
  const [facebook, setFacebook]   = useState<string>(socialRaw.facebook ?? '');

  const [saving, setSaving] = useState(false);

  // ── Busca CEP automaticamente ──────────────────────────────────────────────
  const handleCepBlur = async () => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) return;
      if (data.logradouro) setStreet(data.logradouro);
      if (data.bairro)     setNeighborhood(data.bairro);
      if (data.localidade) setCity(data.localidade);
      if (data.uf)         setState(data.uf);
    } catch {}
  };

  // ── Foto ───────────────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Permita acesso à galeria nas configurações.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Permita acesso à câmera nas configurações.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const handlePhotoMenu = () =>
    Alert.alert('Foto do perfil', 'Como deseja atualizar sua foto?', [
      { text: 'Câmera',              onPress: takePhoto },
      { text: 'Escolher da galeria', onPress: pickPhoto },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  // ── Salvar ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Informe seu nome'); return; }
    if (!city.trim()) { Alert.alert('Informe a cidade'); return; }
    if (!walkerProfile) return;

    setSaving(true);

    let avatarUrl: string | null = walkerProfile.avatar_url ?? null;
    if (avatarUri && avatarUri !== walkerProfile.avatar_url &&
        (avatarUri.startsWith('file://') || avatarUri.startsWith('content://'))) {
      const ext  = 'jpg'; // sempre salva como jpg para consistência
      const mime = 'image/jpeg';
      const path = `${walkerProfile.user_id}/avatar.${ext}`;

      try {
        // Lê o arquivo como ArrayBuffer — funciona de forma confiável no Android/iOS
        const response = await fetch(avatarUri);
        const arrayBuffer = await response.arrayBuffer();

        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, arrayBuffer, { upsert: true, contentType: mime });

        if (upErr) {
          setSaving(false);
          Alert.alert('Erro ao enviar foto', upErr.message);
          return;
        }
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        // Adiciona cache-buster para forçar reload da imagem no app
        avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      } catch (e: any) {
        setSaving(false);
        Alert.alert('Erro ao enviar foto', e?.message ?? 'Tente novamente');
        return;
      }
    } else if (avatarUri && avatarUri !== walkerProfile.avatar_url) {
      avatarUrl = avatarUri;
    }

    const updates = {
      name:              name.trim(),
      phone:             phone.trim() || null,
      cpf:               cpf.trim() || null,
      bio:               bio.trim() || null,
      avatar_url:        avatarUrl,
      cep:               cep.trim() || null,
      street:            street.trim() || null,
      number:            number.trim() || null,
      complement:        complement.trim() || null,
      neighborhood:      neighborhood.trim() || null,
      city:              city.trim(),
      state:             state.trim() || null,
      service_radius_km: radiusKm ? parseInt(radiusKm) : 5,
      social_links: {
        ...(instagram.trim() ? { instagram: instagram.trim() } : {}),
        ...(tiktok.trim()    ? { tiktok: tiktok.trim() }       : {}),
        ...(youtube.trim()   ? { youtube: youtube.trim() }     : {}),
        ...(linkedin.trim()  ? { linkedin: linkedin.trim() }   : {}),
        ...(whatsapp.trim()  ? { whatsapp: whatsapp.trim() }   : {}),
        ...(facebook.trim()  ? { facebook: facebook.trim() }   : {}),
      },
      updated_at:        new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('walker_profiles')
      .update(updates)
      .eq('user_id', walkerProfile.user_id)
      .select()
      .single();

    setSaving(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setWalkerProfile(data);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Perfil</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={styles.saveBtn}>Salvar</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>

          {/* Foto */}
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={handlePhotoMenu} activeOpacity={0.8} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={44} color={Colors.border} />
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePhotoMenu}>
              <Text style={styles.changePhotoText}>Trocar foto</Text>
            </TouchableOpacity>
          </View>

          {/* ── Informações básicas ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INFORMAÇÕES BÁSICAS</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nome completo *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName}
                placeholder="Seu nome" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Telefone (WhatsApp)</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone}
                placeholder="(11) 99999-9999" placeholderTextColor={Colors.textSecondary} keyboardType="phone-pad" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CPF</Text>
              <TextInput style={styles.input} value={cpf} onChangeText={setCpf}
                placeholder="000.000.000-00" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput style={[styles.input, styles.inputMultiline]} value={bio} onChangeText={setBio}
                placeholder="Conte sua experiência com pets..." placeholderTextColor={Colors.textSecondary}
                multiline numberOfLines={4} maxLength={300} />
              <Text style={styles.charCount}>{bio.length}/300</Text>
            </View>
          </View>

          {/* ── Endereço ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ENDEREÇO DE ATENDIMENTO</Text>
            <Text style={styles.sectionHint}>Usado para mostrar ao tutor onde você atende</Text>

            <View style={styles.field}>
              <Text style={styles.label}>CEP</Text>
              <TextInput style={styles.input} value={cep} onChangeText={setCep} onBlur={handleCepBlur}
                placeholder="00000-000" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" maxLength={9} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Rua / Logradouro</Text>
              <TextInput style={styles.input} value={street} onChangeText={setStreet}
                placeholder="Ex: Rua das Flores" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Número</Text>
                <TextInput style={[styles.input, { marginTop: 5 }]} value={number} onChangeText={setNumber}
                  placeholder="123" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>Complemento</Text>
                <TextInput style={[styles.input, { marginTop: 5 }]} value={complement} onChangeText={setComplement}
                  placeholder="Apto 42, Bloco B" placeholderTextColor={Colors.textSecondary} autoCapitalize="sentences" />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bairro</Text>
              <TextInput style={styles.input} value={neighborhood} onChangeText={setNeighborhood}
                placeholder="Ex: Jardim América" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 3 }}>
                <Text style={styles.label}>Cidade *</Text>
                <TextInput style={[styles.input, { marginTop: 5 }]} value={city} onChangeText={setCity}
                  placeholder="Ex: São Paulo" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>UF</Text>
                <TextInput style={[styles.input, { marginTop: 5 }]} value={state} onChangeText={setState}
                  placeholder="SP" placeholderTextColor={Colors.textSecondary} autoCapitalize="characters" maxLength={2} />
              </View>
            </View>
          </View>

          {/* ── Atendimento ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ATENDIMENTO</Text>
            <View>
              <Text style={styles.label}>Raio de atendimento (km)</Text>
              <TextInput style={[styles.input, { marginTop: 5 }]} value={radiusKm} onChangeText={setRadius}
                placeholder="5" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
            </View>

          </View>

          {/* ── Redes Sociais ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REDES SOCIAIS</Text>
            <Text style={styles.sectionHint}>Aparecem no seu perfil público para os tutores</Text>

            {[
              { label: 'Instagram', placeholder: '@seuusuario', value: instagram, onChange: setInstagram, icon: '📸' },
              { label: 'TikTok',    placeholder: '@seuusuario', value: tiktok,    onChange: setTiktok,    icon: '🎵' },
              { label: 'YouTube',   placeholder: 'youtube.com/seucanal', value: youtube, onChange: setYoutube, icon: '▶️' },
              { label: 'LinkedIn',  placeholder: 'linkedin.com/in/seuperfil', value: linkedin, onChange: setLinkedin, icon: '💼' },
              { label: 'WhatsApp',  placeholder: '5527999999999 (com DDI+DDD)', value: whatsapp, onChange: setWhatsapp, icon: '💬' },
              { label: 'Facebook',  placeholder: 'facebook.com/seuperfil', value: facebook, onChange: setFacebook, icon: '👤' },
            ].map(item => (
              <View key={item.label} style={styles.field}>
                <Text style={styles.label}>{item.icon}  {item.label}</Text>
                <TextInput
                  style={styles.input}
                  value={item.value}
                  onChangeText={item.onChange}
                  placeholder={item.placeholder}
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            ))}
          </View>

          {/* Botão salvar */}
          <TouchableOpacity style={styles.saveFullBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveFullBtnText}>Salvar alterações</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerBtn: { width: 60, alignItems: 'flex-start' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  saveBtn: { fontSize: 15, fontWeight: '700', color: Colors.primary, textAlign: 'right', width: 60 },

  scroll: { padding: 20, gap: 24, paddingBottom: 48 },

  photoSection: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  editBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  changePhotoText: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  section: { gap: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  sectionHint: { fontSize: 12, color: Colors.textSecondary, marginTop: -8 },

  field: { gap: 5 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  input: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.text,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: 13 },
  charCount: { fontSize: 11, color: Colors.textSecondary, textAlign: 'right' },

  rowFields: { flexDirection: 'row', gap: 12 },

  saveFullBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveFullBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

});
