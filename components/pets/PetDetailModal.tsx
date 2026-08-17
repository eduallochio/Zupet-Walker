import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import type { LinkedPet } from '../../types/walker';

type Vaccine = {
  id: string;
  vaccine_name: string;
  date_administered: string;
  next_due_date?: string;
};

type Props = { pet: LinkedPet | null; onClose: () => void };

function calcAge(dob: string): string {
  const parts = dob.split('/');
  if (parts.length !== 3) return '';
  const birth = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  const years = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  const age = hadBirthday ? years : years - 1;
  if (age <= 0) {
    const months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    return months <= 1 ? '1 mês' : `${months} meses`;
  }
  return age === 1 ? '1 ano' : `${age} anos`;
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon as any} size={15} color={Colors.textSecondary} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function PetDetailModal({ pet, onClose }: Props) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loadingVaccines, setLoadingVaccines] = useState(false);

  useEffect(() => {
    if (!pet?.pet?.id) { setVaccines([]); return; }
    setLoadingVaccines(true);
    supabase
      .from('vaccinations')
      .select('id, vaccine_name, date_administered, next_due_date')
      .eq('pet_id', pet.pet.id)
      .order('date_administered', { ascending: false })
      .then(({ data }) => {
        setVaccines((data as Vaccine[]) ?? []);
        setLoadingVaccines(false);
      });
  }, [pet?.pet?.id]);

  if (!pet) return null;

  const p = pet.pet;
  const age = p?.dob ? calcAge(p.dob) : null;
  const hasAllergies = (p?.food_allergies && p.food_allergies.length > 0) ||
    (p?.med_allergies && p.med_allergies.length > 0) || p?.restrictions;

  return (
    <Modal visible={!!pet} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ficha do Pet</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero — foto + nome */}
          <View style={styles.hero}>
            <View style={styles.avatar}>
              {p?.photo_uri ? (
                <Image source={{ uri: p.photo_uri }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="paw" size={44} color={Colors.primary} />
              )}
            </View>
            <Text style={styles.petName}>{p?.name ?? '—'}</Text>
            {age && <Text style={styles.petAge}>{age}</Text>}
            <View style={[styles.statusChip, {
              backgroundColor: pet.status === 'active' ? `${Colors.success}20` : `${Colors.warning}20`,
            }]}>
              <Text style={[styles.statusText, {
                color: pet.status === 'active' ? Colors.success : Colors.warning,
              }]}>
                {pet.status === 'active' ? 'Ativo' : pet.status === 'pending' ? 'Pendente' : 'Inativo'}
              </Text>
            </View>
          </View>

          {/* Informações básicas */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INFORMAÇÕES BÁSICAS</Text>
            <View style={styles.card}>
              {p?.species && <InfoRow icon="leaf-outline" label="Espécie" value={p.species} />}
              {p?.breed && <InfoRow icon="paw-outline" label="Raça" value={p.breed} />}
              {p?.gender && <InfoRow icon="male-female-outline" label="Sexo" value={p.gender} />}
              {p?.dob && <InfoRow icon="calendar-outline" label="Nascimento" value={`${p.dob}${age ? ` (${age})` : ''}`} />}
              {p?.weight != null && <InfoRow icon="scale-outline" label="Peso" value={`${p.weight} kg`} />}
              {p?.castrated != null && (
                <InfoRow
                  icon={p.castrated ? 'checkmark-circle-outline' : 'close-circle-outline'}
                  label="Castrado(a)"
                  value={p.castrated ? 'Sim' : 'Não'}
                />
              )}
              {p?.microchip && <InfoRow icon="radio-outline" label="Microchip" value={p.microchip} />}
              <InfoRow icon="link-outline" label="Vinculado em" value={
                pet.linked_at ? new Date(pet.linked_at).toLocaleDateString('pt-BR') : '—'
              } />
            </View>
          </View>

          {/* Alergias e restrições */}
          {hasAllergies && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚠️ ALERGIAS E RESTRIÇÕES</Text>
              <View style={[styles.card, styles.allergyCard]}>
                {p?.food_allergies && p.food_allergies.length > 0 && (
                  <View style={styles.allergyRow}>
                    <Text style={styles.allergyLabel}>Alimentares</Text>
                    <View style={styles.tagRow}>
                      {p.food_allergies.map((a, i) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {p?.med_allergies && p.med_allergies.length > 0 && (
                  <View style={styles.allergyRow}>
                    <Text style={styles.allergyLabel}>Medicamentos</Text>
                    <View style={styles.tagRow}>
                      {p.med_allergies.map((a, i) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {p?.restrictions && (
                  <View style={styles.allergyRow}>
                    <Text style={styles.allergyLabel}>Observações</Text>
                    <Text style={styles.allergyText}>{p.restrictions}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Vacinas */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💉 VACINAS</Text>
            <View style={styles.card}>
              {loadingVaccines ? (
                <ActivityIndicator color={Colors.primary} style={{ padding: 20 }} />
              ) : vaccines.length === 0 ? (
                <View style={styles.emptyVaccines}>
                  <Text style={styles.emptyVaccinesText}>Nenhuma vacina registrada</Text>
                </View>
              ) : (
                vaccines.map((v, i) => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const isOverdue = v.next_due_date
                    ? (() => { const parts = v.next_due_date!.split('/'); return new Date(+parts[2], +parts[1]-1, +parts[0]) < today; })()
                    : false;
                  const statusColor = isOverdue ? '#F59E0B' : '#10B981';
                  const statusLabel = isOverdue ? 'Vencida' : 'Em dia';
                  return (
                    <View key={v.id} style={[styles.vaccineRow, i === vaccines.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[styles.vaccineDot, { backgroundColor: `${statusColor}20` }]}>
                        <Ionicons name={isOverdue ? 'warning-outline' : 'checkmark-circle-outline'} size={16} color={statusColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vaccineName}>{v.vaccine_name}</Text>
                        <Text style={styles.vaccineDates}>
                          Aplicada: {v.date_administered}
                          {v.next_due_date ? ` · Reforço: ${v.next_due_date}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.vaccineStatus, { backgroundColor: `${statusColor}15` }]}>
                        <Text style={[styles.vaccineStatusText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Tutor */}
          {pet.owner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TUTOR</Text>
              <View style={[styles.card, { padding: 14 }]}>
                <View style={styles.ownerRow}>
                  <View style={styles.ownerAvatar}>
                    {pet.owner.avatar_url ? (
                      <Image source={{ uri: pet.owner.avatar_url }} style={styles.ownerAvatarImg} />
                    ) : (
                      <Ionicons name="person" size={22} color={Colors.primary} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.ownerName}>{pet.owner.name ?? '—'}</Text>
                    <Text style={styles.ownerSub}>Responsável pelo pet</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  closeBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  scroll: { padding: 20, gap: 20, paddingBottom: 48 },

  hero: { alignItems: 'center', gap: 10 },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    borderWidth: 3, borderColor: `${Colors.primary}30`,
  },
  avatarImg: { width: 110, height: 110 },
  petName: { fontSize: 26, fontWeight: '800', color: Colors.text },
  petAge: { fontSize: 14, color: Colors.textSecondary },
  statusChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },

  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },

  card: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoIconWrap: { width: 20, alignItems: 'center' },
  infoLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  allergyCard: {
    borderColor: '#F59E0B40',
    backgroundColor: '#FEF3C710',
  },
  allergyRow: { padding: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: '#F59E0B20' },
  allergyLabel: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  allergyText: { fontSize: 13, color: Colors.text, lineHeight: 19 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: '#EF444420', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  emptyVaccines: { padding: 20, alignItems: 'center' },
  emptyVaccinesText: { fontSize: 13, color: Colors.textSecondary },
  vaccineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  vaccineDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vaccineName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  vaccineDates: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  vaccineStatus: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  vaccineStatusText: { fontSize: 11, fontWeight: '700' },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  ownerAvatarImg: { width: 46, height: 46 },
  ownerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  ownerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
