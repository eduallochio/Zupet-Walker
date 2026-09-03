import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';

type ServiceType = 'walk' | 'bath' | 'boarding' | 'daycare' | 'training' | 'vet_visit';

const SERVICE_OPTIONS: { type: ServiceType; label: string; icon: string }[] = [
  { type: 'walk',      label: 'Passeio',             icon: '🐾' },
  { type: 'bath',      label: 'Banho e Tosa',         icon: '🛁' },
  { type: 'boarding',  label: 'Hospedagem',           icon: '🏠' },
  { type: 'daycare',   label: 'Day Care',             icon: '☀️' },
  { type: 'training',  label: 'Adestramento',         icon: '🎓' },
  { type: 'vet_visit', label: 'Visita Veterinária',   icon: '🩺' },
];

type LinkedPet = {
  pet_id: string;
  name: string;
  breed?: string;
  owner_id?: string;   // presente se pet tem tutor vinculado no Zupet
  owner_name?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function NewScheduleModal({ visible, onClose, onCreated }: Props) {
  const walkerProfile = useAuthStore((s) => s.walkerProfile);

  const [serviceType, setServiceType] = useState<ServiceType>('walk');
  const [date, setDate]       = useState('');
  const [time, setTime]       = useState('');
  const [duration, setDuration] = useState('60');
  const [amount, setAmount]   = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);

  const [pets, setPets]         = useState<LinkedPet[]>([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [selectedPets, setSelectedPets] = useState<Set<string>>(new Set());

  // Carrega pets vinculados ao walker quando o modal abre
  useEffect(() => {
    if (!visible || !walkerProfile) return;
    setLoadingPets(true);

    const load = async () => {
      // 1. Busca links ativos com dados do pet
      const { data: links } = await supabase
        .from('walker_pet_links')
        .select('pet_id, owner_id, pet:pets(id, name, breed)')
        .eq('walker_id', walkerProfile.id)
        .eq('status', 'active');

      const linkRows = (links ?? []) as any[];
      if (linkRows.length === 0) { setLoadingPets(false); return; }

      // 2. Busca nomes dos owners em uma única query
      const ownerIds = [...new Set(linkRows.map((r: any) => r.owner_id).filter(Boolean))];
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('user_profiles')
          .select('user_id, name')
          .in('user_id', ownerIds);
        ownerMap = Object.fromEntries((owners ?? []).map((o: any) => [o.user_id, o.name]));
      }

      const result: LinkedPet[] = linkRows
        .filter((r: any) => r.pet)
        .map((r: any) => ({
          pet_id:     r.pet_id,
          name:       r.pet.name,
          breed:      r.pet.breed,
          owner_id:   r.owner_id ?? undefined,
          owner_name: r.owner_id ? ownerMap[r.owner_id] : undefined,
        }));

      setPets(result);
      setLoadingPets(false);
    };

    load();
  }, [visible, walkerProfile]);

  const resetForm = () => {
    setServiceType('walk');
    setDate('');
    setTime('');
    setDuration('60');
    setAmount('');
    setNotes('');
    setSelectedPets(new Set());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const togglePet = (petId: string) => {
    setSelectedPets((prev) => {
      const next = new Set(prev);
      if (next.has(petId)) next.delete(petId);
      else next.add(petId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!walkerProfile) return;

    // Valida data dd/mm/aaaa
    const [day, month, year] = date.split('/').map(Number);
    const [hour, min] = time.split(':').map(Number);
    if (!day || !month || !year || isNaN(hour) || isNaN(min)) {
      Alert.alert('Dados incompletos', 'Preencha data (dd/mm/aaaa) e hora (HH:mm).');
      return;
    }
    const scheduledAt = new Date(year, month - 1, day, hour, min);
    if (scheduledAt < new Date()) {
      Alert.alert('Data inválida', 'A data e hora devem ser no futuro.');
      return;
    }

    const dur = parseInt(duration, 10);
    if (!dur || dur < 1) {
      Alert.alert('Duração inválida', 'Informe a duração em minutos.');
      return;
    }

    setSaving(true);
    try {
      // Descobre owner_id: se todos os pets selecionados têm o mesmo dono, usa ele; senão null
      const selectedList = pets.filter((p) => selectedPets.has(p.pet_id));
      const ownerIds = [...new Set(selectedList.map((p) => p.owner_id).filter(Boolean))];
      const ownerId = ownerIds.length === 1 ? ownerIds[0] : null;

      const { error } = await supabase.from('walk_schedules').insert({
        walker_id:        walkerProfile.id,
        owner_id:         ownerId ?? null,
        service_type:     serviceType,
        scheduled_at:     scheduledAt.toISOString(),
        duration_minutes: dur,
        pet_ids:          Array.from(selectedPets),
        status:           'confirmed',
        notes:            notes.trim() || null,
        amount:           amount ? parseFloat(amount.replace(',', '.')) : null,
        proposed_by:      'walker',
      });

      if (error) throw error;

      // Notifica o tutor se há owner_id
      if (ownerId) {
        const dateLabel = scheduledAt.toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const svcLabel = SERVICE_OPTIONS.find((s) => s.type === serviceType)?.label ?? 'Serviço';
        await supabase.from('notifications').insert({
          user_id: ownerId,
          type:    'schedule_confirmed',
          title:   `📅 ${svcLabel} agendado`,
          body:    `${walkerProfile.name} agendou um ${svcLabel.toLowerCase()} para ${dateLabel}.`,
          data:    { walker_id: walkerProfile.id },
        });
      }

      resetForm();
      onCreated();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o agendamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const svcOption = SERVICE_OPTIONS.find((s) => s.type === serviceType)!;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Novo agendamento</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>

            {/* Tipo de serviço */}
            <Text style={styles.label}>Tipo de serviço</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceRow}>
              {SERVICE_OPTIONS.map((opt) => {
                const active = opt.type === serviceType;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[styles.serviceChip, active && styles.serviceChipActive]}
                    onPress={() => setServiceType(opt.type)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.serviceChipIcon}>{opt.icon}</Text>
                    <Text style={[styles.serviceChipText, active && styles.serviceChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Data e hora */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Data</Text>
                <TextInput
                  style={styles.input}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={Colors.textSecondary}
                  value={date}
                  onChangeText={setDate}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Hora</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:mm"
                  placeholderTextColor={Colors.textSecondary}
                  value={time}
                  onChangeText={setTime}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Duração e valor */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Duração (min)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="60"
                  placeholderTextColor={Colors.textSecondary}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Valor (R$)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0,00"
                  placeholderTextColor={Colors.textSecondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  maxLength={8}
                />
              </View>
            </View>

            {/* Pets vinculados */}
            <Text style={styles.label}>Pets <Text style={styles.labelSub}>(opcional)</Text></Text>
            {loadingPets ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 8 }} />
            ) : pets.length === 0 ? (
              <Text style={styles.noPets}>Nenhum pet vinculado a você no Zupet.</Text>
            ) : (
              <View style={styles.petList}>
                {pets.map((pet) => {
                  const sel = selectedPets.has(pet.pet_id);
                  return (
                    <TouchableOpacity
                      key={pet.pet_id}
                      style={[styles.petRow, sel && styles.petRowSelected]}
                      onPress={() => togglePet(pet.pet_id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.petAvatar, sel && styles.petAvatarSelected]}>
                        <Ionicons name="paw" size={16} color={sel ? '#fff' : Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.petName}>{pet.name}</Text>
                        {pet.breed ? <Text style={styles.petBreed}>{pet.breed}</Text> : null}
                        {pet.owner_name ? (
                          <View style={styles.ownerTag}>
                            <Ionicons name="person-outline" size={10} color={Colors.primary} />
                            <Text style={styles.ownerTagText}>{pet.owner_name} · tutor no Zupet</Text>
                          </View>
                        ) : null}
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Aviso de notificação ao tutor */}
            {selectedPets.size > 0 && pets.some((p) => selectedPets.has(p.pet_id) && p.owner_id) && (
              <View style={styles.notifHint}>
                <Ionicons name="notifications-outline" size={14} color={Colors.primary} />
                <Text style={styles.notifHintText}>
                  O tutor será notificado sobre este agendamento.
                </Text>
              </View>
            )}

            {/* Observações */}
            <Text style={styles.label}>Observações <Text style={styles.labelSub}>(opcional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações sobre o serviço..."
              placeholderTextColor={Colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />

            {/* Botão salvar */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Criar agendamento</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  closeBtn: { padding: 4 },

  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },

  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  labelSub: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },

  serviceRow: { gap: 8, paddingVertical: 4 },
  serviceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  serviceChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}15` },
  serviceChipIcon: { fontSize: 16 },
  serviceChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  serviceChipTextActive: { color: Colors.primary },

  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 4 },

  input: {
    backgroundColor: Colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
  },
  textArea: { minHeight: 80 },

  noPets: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  petList: { gap: 8 },
  petRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 14,
    padding: 12, borderWidth: 1.5, borderColor: Colors.border,
  },
  petRowSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  petAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  petAvatarSelected: { backgroundColor: Colors.primary },
  petName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  petBreed: { fontSize: 12, color: Colors.textSecondary },
  ownerTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ownerTagText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  notifHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary}12`,
    borderRadius: 10, padding: 10,
  },
  notifHintText: { fontSize: 12, color: Colors.primary, fontWeight: '600', flex: 1 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
