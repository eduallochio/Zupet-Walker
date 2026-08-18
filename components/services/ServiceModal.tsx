import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Switch, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import AvailabilityEditor, { type AvailableSlots } from '../availability/AvailabilityEditor';

export type ServiceType = 'walk' | 'daycare' | 'boarding' | 'training' | 'bath' | 'vet_visit';

export type BillingType = 'per_session' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type WalkerService = {
  id: string;
  walker_id: string;
  type: ServiceType;
  label: string;
  description: string | null;
  price: number;
  price_daily: number;
  price_weekly: number;
  price_biweekly: number;
  price_monthly: number;
  duration_minutes: number;
  max_pets: number;
  active: boolean;
  sort_order: number;
  available_slots: AvailableSlots;
  blocked_slots: Record<string, string[]>;
};

export type ServiceForm = Omit<WalkerService, 'id' | 'walker_id' | 'blocked_slots'>;

export const SERVICE_CATALOG: { type: ServiceType; label: string; icon: string; defaultDuration: number }[] = [
  { type: 'walk',      label: 'Passeio',       icon: '🦮', defaultDuration: 60   },
  { type: 'daycare',   label: 'Creche',        icon: '🏠', defaultDuration: 480  },
  { type: 'boarding',  label: 'Hospedagem',    icon: '🌙', defaultDuration: 1440 },
  { type: 'training',  label: 'Adestramento',  icon: '🎯', defaultDuration: 60   },
  { type: 'bath',      label: 'Banho e Tosa',  icon: '🛁', defaultDuration: 90   },
  { type: 'vet_visit', label: 'Visita ao Vet', icon: '🏥', defaultDuration: 60   },
];

export const BILLING_OPTIONS: { type: BillingType; label: string; short: string }[] = [
  { type: 'per_session', label: 'Por sessão',   short: '/sessão'   },
  { type: 'daily',       label: 'Diário',       short: '/dia'      },
  { type: 'weekly',      label: 'Semanal',      short: '/semana'   },
  { type: 'biweekly',    label: 'Quinzenal',    short: '/quinzena' },
  { type: 'monthly',     label: 'Mensal',       short: '/mês'      },
];

export function getPriceForBilling(svc: WalkerService, billing: BillingType): number {
  if (billing === 'daily')     return svc.price_daily;
  if (billing === 'weekly')    return svc.price_weekly;
  if (billing === 'biweekly')  return svc.price_biweekly;
  if (billing === 'monthly')   return svc.price_monthly;
  return svc.price;
}

export function defaultForm(type: ServiceType): ServiceForm {
  const cat = SERVICE_CATALOG.find((c) => c.type === type)!;
  return {
    type,
    label:            cat.label,
    description:      null,
    price:            0,
    price_daily:      0,
    price_weekly:     0,
    price_biweekly:   0,
    price_monthly:    0,
    duration_minutes: cat.defaultDuration,
    max_pets:         3,
    active:           true,
    sort_order:       0,
    available_slots:  {},
  };
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

type Props = {
  visible: boolean;
  initial: (WalkerService & { isNew?: boolean }) | null;
  onClose: () => void;
  onSave: (form: ServiceForm, id?: string) => Promise<void>;
  onDelete?: (id: string) => void;
};

export default function ServiceModal({ visible, initial, onClose, onSave, onDelete }: Props) {
  const isNew = !initial || initial.isNew;

  const fromInitial = (src: WalkerService): ServiceForm => ({
    type:             src.type,
    label:            src.label,
    description:      src.description,
    price:            src.price,
    price_daily:      src.price_daily ?? 0,
    price_weekly:     src.price_weekly ?? 0,
    price_biweekly:   src.price_biweekly ?? 0,
    price_monthly:    src.price_monthly ?? 0,
    duration_minutes: src.duration_minutes,
    max_pets:         src.max_pets,
    active:           src.active,
    sort_order:       src.sort_order,
    available_slots:  src.available_slots ?? {},
  });

  const [form, setForm] = useState<ServiceForm>(
    initial ? fromInitial(initial) : defaultForm('walk')
  );
  const [priceText, setPriceText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm(fromInitial(initial));
      setPriceText({});
    }
  }, [initial]);

  const handleSave = async () => {
    if (!form.label.trim()) { Alert.alert('Informe o nome do serviço.'); return; }
    if (isNew && Object.keys(form.available_slots).length === 0) {
      Alert.alert('Configure os horários', 'Selecione ao menos um dia e horário disponível para este serviço.');
      return;
    }
    setSaving(true);
    await onSave(form, isNew ? undefined : initial!.id);
    setSaving(false);
  };

  const cat = SERVICE_CATALOG.find((c) => c.type === form.type) ?? SERVICE_CATALOG[0];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.modalHeaderBtn}>
              <Text style={{ fontSize: 15, color: Colors.error }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {cat.icon} {isNew ? 'Novo serviço' : 'Editar serviço'}
            </Text>
            <TouchableOpacity onPress={handleSave} style={styles.modalHeaderBtn} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary }}>Salvar</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Tipo (só na criação) */}
            {isNew && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>TIPO DE SERVIÇO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {SERVICE_CATALOG.map((c) => (
                    <TouchableOpacity
                      key={c.type}
                      style={[styles.typeChip, form.type === c.type && styles.typeChipActive]}
                      onPress={() => setForm((f) => ({ ...defaultForm(c.type), active: f.active }))}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.typeChipIcon}>{c.icon}</Text>
                      <Text style={[styles.typeChipText, form.type === c.type && { color: '#fff' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Nome */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>NOME DO SERVIÇO</Text>
              <TextInput
                style={styles.formInput}
                value={form.label}
                onChangeText={(t) => setForm((f) => ({ ...f, label: t }))}
                placeholder="Ex: Passeio matinal"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="sentences"
              />
            </View>

            {/* Descrição */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>DESCRIÇÃO (opcional)</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                value={form.description ?? ''}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t || null }))}
                placeholder="Descreva o serviço para o tutor..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Preços por frequência + Duração */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>PREÇOS POR FREQUÊNCIA (R$)</Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>
                Deixe em 0 os que não se aplicam a este serviço.
              </Text>
              <View style={styles.priceGrid}>
                {([
                  { key: 'price',          label: 'Por sessão' },
                  { key: 'price_daily',    label: 'Diário'     },
                  { key: 'price_weekly',   label: 'Semanal'    },
                  { key: 'price_biweekly', label: 'Quinzenal'  },
                  { key: 'price_monthly',  label: 'Mensal'     },
                ] as { key: keyof ServiceForm; label: string }[]).map(({ key, label }) => (
                  <View key={key} style={styles.priceCell}>
                    <Text style={styles.priceCellLabel}>{label}</Text>
                    <TextInput
                      style={styles.priceCellInput}
                      value={priceText[key] ?? ((form[key] as number) > 0 ? String(form[key]) : '')}
                      onChangeText={(t) => {
                        const clean = t.replace(/[^0-9.,]/g, '');
                        setPriceText((p) => ({ ...p, [key]: clean }));
                        const num = parseFloat(clean.replace(',', '.')) || 0;
                        setForm((f) => ({ ...f, [key]: num }));
                      }}
                      onBlur={() => {
                        const raw = priceText[key] ?? '';
                        const num = parseFloat(raw.replace(',', '.')) || 0;
                        setForm((f) => ({ ...f, [key]: num }));
                        setPriceText((p) => ({ ...p, [key]: num > 0 ? String(num) : '' }));
                      }}
                      placeholder="0"
                      placeholderTextColor={Colors.textSecondary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 8 }}>
                <Text style={styles.fieldLabel}>Duração (min)</Text>
                <TextInput
                  style={[styles.formInput, { marginTop: 5 }]}
                  value={form.duration_minutes.toString()}
                  onChangeText={(t) => setForm((f) => ({ ...f, duration_minutes: parseInt(t) || 0 }))}
                  placeholder="60"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Horários por dia */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>DIAS E HORÁRIOS DISPONÍVEIS</Text>
              <AvailabilityEditor
                value={form.available_slots}
                onChange={(v) => setForm((f) => ({ ...f, available_slots: v }))}
              />
            </View>

            {/* Capacidade */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>CAPACIDADE</Text>
              <Text style={styles.fieldLabel}>Máximo de pets por atendimento</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setForm((f) => ({ ...f, max_pets: Math.max(1, f.max_pets - 1) }))}
                >
                  <Ionicons name="remove" size={20} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{form.max_pets}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setForm((f) => ({ ...f, max_pets: Math.min(20, f.max_pets + 1) }))}
                >
                  <Ionicons name="add" size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Ativo */}
            <View style={[styles.formSection, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <View>
                <Text style={styles.formLabel}>SERVIÇO ATIVO</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                  Visível para tutores quando ativo
                </Text>
              </View>
              <Switch
                value={form.active}
                onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
                trackColor={{ true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Excluir */}
            {!isNew && onDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  Alert.alert('Excluir serviço', 'Tem certeza? Esta ação não pode ser desfeita.', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Excluir', style: 'destructive', onPress: () => { onClose(); onDelete(initial!.id); } },
                  ]);
                }}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={styles.deleteBtnText}>Excluir serviço</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  modalHeaderBtn: { minWidth: 70 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalScroll: { padding: 20, gap: 24, paddingBottom: 48 },

  formSection: { gap: 8 },
  formLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  formInput: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.text,
  },

  typeChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 4,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipIcon: { fontSize: 18 },
  typeChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },

  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  priceCell: { width: '30%', gap: 4 },
  priceCellLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  priceCellInput: {
    backgroundColor: Colors.card, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 14, color: Colors.text, textAlign: 'center',
  },

  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 4 },
  counterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  counterValue: { fontSize: 22, fontWeight: '800', color: Colors.text, minWidth: 32, textAlign: 'center' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14, marginTop: 8,
    backgroundColor: `${Colors.error}10`, borderWidth: 1, borderColor: `${Colors.error}30`,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: Colors.error },
});
