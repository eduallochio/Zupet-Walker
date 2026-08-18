import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

const TOTAL_STEPS = 5;

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function WalkerProfileOnboarding() {
  const user             = useAuthStore((s) => s.user);
  const setWalkerProfile = useAuthStore((s) => s.setWalkerProfile);

  const socialName   = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '';
  const socialAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? '';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Identidade
  const [name, setName]     = useState(socialName);
  const [cep, setCep]       = useState('');
  const [street, setStreet]             = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity]     = useState('');
  const [state, setState]   = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [phone, setPhone]   = useState('');
  const [avatarUri, setAvatarUri] = useState<string>(socialAvatar);

  // Step 2 — Experiência
  const [bio, setBio]                   = useState('');
  const [experienceYears, setExpYears]  = useState('');
  const [certifications, setCerts]      = useState('');

  // Step 3 — Atendimento
  const [maxPets, setMaxPets] = useState('3');
  const [radiusKm, setRadius] = useState('5');

  // Step 4 — Disponibilidade
  const [availableDays, setDays]     = useState<number[]>([0, 1, 2, 3, 4]);
  const [startTime, setStartTime]    = useState('08:00');
  const [endTime, setEndTime]        = useState('18:00');

  // Step 5 — Documentos
  const [cpf, setCpf]               = useState('');
  const [termsAccepted, setTerms]   = useState(false);

  // Busca CEP via ViaCEP
  const handleCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    setCep(digits);
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (data.erro) {
          Alert.alert('CEP não encontrado', 'Preencha o endereço manualmente.');
        } else {
          if (data.logradouro) setStreet(data.logradouro);
          if (data.bairro)     setNeighborhood(data.bairro);
          if (data.localidade) setCity(data.localidade);
          if (data.uf)         setState(data.uf);
        }
      } catch {
        Alert.alert('Erro ao buscar CEP', 'Preencha o endereço manualmente.');
      }
      setCepLoading(false);
    }
  };

  // Foto
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
      { text: 'Câmera', onPress: takePhoto },
      { text: 'Escolher da galeria', onPress: pickPhoto },
      socialAvatar ? { text: 'Usar foto do Google/Apple', onPress: () => setAvatarUri(socialAvatar) } : null,
      { text: 'Cancelar', style: 'cancel' },
    ].filter(Boolean) as any);

  const toggleDay = (i: number) =>
    setDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i]);

  const goNext = () => {
    if (step === 1) {
      if (!name.trim()) { Alert.alert('Informe seu nome completo'); return; }
      if (!city.trim()) { Alert.alert('Informe sua cidade de atuação'); return; }
    }
    if (step === 4 && availableDays.length === 0) {
      Alert.alert('Selecione ao menos um dia disponível'); return;
    }
    if (step === 4) {
      const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRe.test(startTime)) { Alert.alert('Horário inválido', 'Digite o horário de início no formato HH:mm (ex: 08:00)'); return; }
      if (!timeRe.test(endTime))   { Alert.alert('Horário inválido', 'Digite o horário de término no formato HH:mm (ex: 18:00)'); return; }
      if (startTime >= endTime)    { Alert.alert('Horário inválido', 'O horário de término deve ser após o início'); return; }
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSave = async () => {
    if (!termsAccepted) { Alert.alert('Aceite os Termos de Uso para continuar'); return; }

    setSaving(true);

    let avatarUrl: string | null = null;
    if (avatarUri && (avatarUri.startsWith('file://') || avatarUri.startsWith('content://'))) {
      const ext  = avatarUri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const path = `${user!.id}/avatar.${ext}`;
      const blob = await (await fetch(avatarUri)).blob();
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }
    } else if (avatarUri) {
      avatarUrl = avatarUri;
    }

    const certsArr = certifications.trim()
      ? certifications.split(',').map((c) => c.trim()).filter(Boolean)
      : null;

    const { data, error } = await supabase
      .from('walker_profiles')
      .insert({
        user_id:           user!.id,
        name:              name.trim(),
        city:              city.trim(),
        cep:               cep.trim() || null,
        street:            street.trim() || null,
        number:            addressNumber.trim() || null,
        neighborhood:      neighborhood.trim() || null,
        state:             state.trim() || null,
        phone:             phone.trim() || null,
        bio:               bio.trim() || null,
        experience_years:  experienceYears ? parseInt(experienceYears) : 0,
        certifications:    certsArr,
        max_pets_per_walk: maxPets ? parseInt(maxPets) : 3,
        service_radius_km: radiusKm ? parseInt(radiusKm) : 5,
        available_days:    availableDays,
        available_start:   startTime,
        available_end:     endTime,
        cpf:               cpf.trim() || null,
        terms_accepted:    true,
        terms_accepted_at: new Date().toISOString(),
        avatar_url:        avatarUrl,
        active:            true,
        plan:              'free',
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }

    setWalkerProfile(data);
  };

  const ProgressBar = () => (
    <View style={styles.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[styles.progressBar, i < step && styles.progressBarActive]} />
      ))}
    </View>
  );

  const StepHeader = ({ stepLabel, title, subtitle }: { stepLabel: string; title: string; subtitle: string }) => (
    <View style={styles.stepHeader}>
      <Text style={styles.stepLabel}>{stepLabel}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSub}>{subtitle}</Text>
    </View>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <ProgressBar />

          {/* ── PASSO 1: Identidade ── */}
          {step === 1 && (
            <>
              <StepHeader
                stepLabel={`PASSO 1 DE ${TOTAL_STEPS}`}
                title="Crie seu perfil profissional"
                subtitle="Essas informações serão visíveis para os donos de pets"
              />

              <TouchableOpacity onPress={handlePhotoMenu} activeOpacity={0.8} style={styles.avatarSection}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={32} color={Colors.primary} />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera" size={13} color="#fff" />
                </View>
                <Text style={styles.avatarLabel}>{avatarUri ? 'Trocar foto' : 'Adicionar foto'}</Text>
              </TouchableOpacity>

              <View style={styles.form}>
                <Field label="Nome completo *">
                  <TextInput style={styles.input} value={name} onChangeText={setName}
                    placeholder="Eduardo Allocchio" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
                </Field>
                <Field label="CEP">
                  <View style={styles.inputRow}>
                    <TextInput style={[styles.input, { flex: 1 }]} value={cep} onChangeText={handleCepChange}
                      placeholder="00000-000" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" maxLength={8} />
                    {cepLoading && <ActivityIndicator style={styles.cepSpinner} color={Colors.primary} size="small" />}
                  </View>
                </Field>
                <Field label="Rua / Logradouro">
                  <TextInput style={styles.input} value={street} onChangeText={setStreet}
                    placeholder="Preenchido pelo CEP ou digite" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
                </Field>
                <View style={styles.rowFields}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Número</Text>
                    <TextInput style={styles.input} value={addressNumber} onChangeText={setAddressNumber}
                      placeholder="123" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.fieldLabel}>Bairro</Text>
                    <TextInput style={styles.input} value={neighborhood} onChangeText={setNeighborhood}
                      placeholder="Preenchido pelo CEP" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
                  </View>
                </View>
                <View style={styles.rowFields}>
                  <View style={{ flex: 3 }}>
                    <Text style={styles.fieldLabel}>Cidade *</Text>
                    <TextInput style={styles.input} value={city} onChangeText={setCity}
                      placeholder="Preenchido pelo CEP" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>UF</Text>
                    <TextInput style={styles.input} value={state} onChangeText={setState}
                      placeholder="SP" placeholderTextColor={Colors.textSecondary} autoCapitalize="characters" maxLength={2} />
                  </View>
                </View>
                <Field label="Telefone (WhatsApp)">
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone}
                    placeholder="(11) 99999-9999" placeholderTextColor={Colors.textSecondary} keyboardType="phone-pad" />
                </Field>
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextBtnText}>Próximo →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── PASSO 2: Experiência ── */}
          {step === 2 && (
            <>
              <StepHeader
                stepLabel={`PASSO 2 DE ${TOTAL_STEPS}`}
                title="Sua experiência"
                subtitle="Conte aos tutores o que você sabe fazer com pets"
              />
              <View style={styles.form}>
                <Field label="Apresentação profissional *">
                  <TextInput style={[styles.input, styles.inputMultiline]} value={bio} onChangeText={setBio}
                    placeholder="Conte sobre você e sua experiência com pets..."
                    placeholderTextColor={Colors.textSecondary} multiline numberOfLines={4} maxLength={300} />
                  <Text style={styles.charCount}>{bio.length}/300</Text>
                </Field>
                <Field label="Anos de experiência com pets">
                  <TextInput style={styles.input} value={experienceYears} onChangeText={setExpYears}
                    placeholder="Ex: 3" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                </Field>
                <Field label="Certificações (separe por vírgula)">
                  <TextInput style={styles.input} value={certifications} onChangeText={setCerts}
                    placeholder="Ex: Primeiros socorros, Adestramento básico"
                    placeholderTextColor={Colors.textSecondary} autoCapitalize="sentences" />
                </Field>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                  <Ionicons name="arrow-back" size={18} color={Colors.primary} />
                  <Text style={styles.backBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={goNext}>
                  <Text style={styles.nextBtnText}>Próximo →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── PASSO 3: Capacidade ── */}
          {step === 3 && (
            <>
              <StepHeader
                stepLabel={`PASSO 3 DE ${TOTAL_STEPS}`}
                title="Capacidade de atendimento"
                subtitle="Defina quantos pets você atende e a sua área de cobertura"
              />
              <View style={styles.form}>
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.infoCardText}>
                    Seus serviços e preços podem ser configurados depois no menu "Meus Serviços".
                  </Text>
                </View>
                <View style={styles.rowFields}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Máx. pets por passeio</Text>
                    <TextInput style={styles.input} value={maxPets} onChangeText={setMaxPets}
                      placeholder="3" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Raio de atendimento (km)</Text>
                    <TextInput style={styles.input} value={radiusKm} onChangeText={setRadius}
                      placeholder="5" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                  </View>
                </View>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                  <Ionicons name="arrow-back" size={18} color={Colors.primary} />
                  <Text style={styles.backBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={goNext}>
                  <Text style={styles.nextBtnText}>Próximo →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── PASSO 4: Disponibilidade ── */}
          {step === 4 && (
            <>
              <StepHeader
                stepLabel={`PASSO 4 DE ${TOTAL_STEPS}`}
                title="Sua disponibilidade"
                subtitle="Quando você está disponível para passeios?"
              />
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>Dias disponíveis *</Text>
                <View style={styles.daysRow}>
                  {DAYS.map((d, i) => {
                    const active = availableDays.includes(i);
                    return (
                      <TouchableOpacity key={d} style={[styles.dayChip, active && styles.dayChipActive]}
                        onPress={() => toggleDay(i)} activeOpacity={0.8}>
                        <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Horário de atendimento</Text>
                <View style={styles.rowFields}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabelSm}>Início</Text>
                    <TextInput style={styles.input} value={startTime} onChangeText={setStartTime}
                      placeholder="08:00" placeholderTextColor={Colors.textSecondary} keyboardType="numbers-and-punctuation" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabelSm}>Término</Text>
                    <TextInput style={styles.input} value={endTime} onChangeText={setEndTime}
                      placeholder="18:00" placeholderTextColor={Colors.textSecondary} keyboardType="numbers-and-punctuation" />
                  </View>
                </View>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                  <Ionicons name="arrow-back" size={18} color={Colors.primary} />
                  <Text style={styles.backBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={goNext}>
                  <Text style={styles.nextBtnText}>Próximo →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── PASSO 5: Documentos ── */}
          {step === 5 && (
            <>
              <StepHeader
                stepLabel={`PASSO 5 DE ${TOTAL_STEPS}`}
                title="Quase lá!"
                subtitle="Precisamos de algumas informações para verificar sua identidade"
              />
              <View style={styles.form}>
                <Field label="CPF (opcional)">
                  <TextInput style={styles.input} value={cpf} onChangeText={setCpf}
                    placeholder="000.000.000-00" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                </Field>

                <TouchableOpacity style={styles.termsRow} onPress={() => setTerms((v) => !v)} activeOpacity={0.8}>
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                    {termsAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.termsText}>
                    Li e aceito os{' '}
                    <Text style={styles.termsLink}>Termos de Uso</Text>
                    {' '}e{' '}
                    <Text style={styles.termsLink}>Política de Privacidade</Text>
                    {' '}do Zupet Walker
                  </Text>
                </TouchableOpacity>

                <Text style={styles.privacyNote}>
                  🔒 Seus dados são protegidos e nunca serão compartilhados sem sua autorização.
                </Text>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                  <Ionicons name="arrow-back" size={18} color={Colors.primary} />
                  <Text style={styles.backBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }, !termsAccepted && styles.nextBtnDisabled]}
                  onPress={handleSave} disabled={saving || !termsAccepted}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.nextBtnText}>Criar meu perfil ✓</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, flexGrow: 1, paddingBottom: 40, gap: 20 },

  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  progressBarActive: { backgroundColor: Colors.primary },

  stepHeader: { gap: 4 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8 },
  stepTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 30 },
  stepSub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 2, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute', bottom: 28, right: '35%',
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  avatarLabel: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  form: { gap: 16 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  fieldLabelSm: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 5 },
  input: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.text,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: 13 },
  charCount: { fontSize: 11, color: Colors.textSecondary, textAlign: 'right' },

  rowFields: { flexDirection: 'row', gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  cepSpinner: { position: 'absolute', right: 14 },

  infoCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: `${Colors.primary}12`, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: `${Colors.primary}30`,
  },
  infoCardText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Dias
  daysRow: { flexDirection: 'row', gap: 6 },
  dayChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  dayChipTextActive: { color: '#fff' },

  // Termos
  termsRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  termsLink: { color: Colors.primary, fontWeight: '600' },
  privacyNote: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, textAlign: 'center' },

  // Botões
  btnRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  nextBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, padding: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnDisabled: { backgroundColor: Colors.border },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 15, paddingHorizontal: 4 },
  backBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
});
