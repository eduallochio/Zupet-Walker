import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { PetCard } from '../../components/pets/PetCard';
import { PetDetailModal } from '../../components/pets/PetDetailModal';
import { OwnPetModal } from '../../components/pets/OwnPetModal';
import type { LinkedPet } from '../../types/walker';
import { sendPushToOwner } from '../../services/ownerPushService';
import { getLimits } from '../../lib/plan';

type FilterTab = 'todos' | 'active' | 'pending';

type WalkerService = { id: string; type: string; label: string; price: number; billing_type: string };
type PendingAccept = { pet: LinkedPet; services: WalkerService[] };

type OwnPet = {
  id: string;
  name: string;
  breed: string | null;
  photo_uri: string | null;
  species: string | null;
  gender: string | null;
  pet_link_code: string | null;
  isMerged?: boolean;
};

export default function PetsScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [pets, setPets] = useState<LinkedPet[]>([]);
  const [ownPets, setOwnPets] = useState<OwnPet[]>([]);
  const [selectedOwnPet, setSelectedOwnPet] = useState<OwnPet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('todos');
  const [selectedPet, setSelectedPet] = useState<LinkedPet | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [pendingAccept, setPendingAccept] = useState<PendingAccept | null>(null);

  const unlinkPet = async (pet: LinkedPet) => {
    const petName = pet.pet?.name ?? 'este pet';

    Alert.alert(
      'Desvincular pet',
      `Deseja remover ${petName} da sua lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Pagamentos pendentes',
              `Deseja cancelar os pagamentos pendentes de ${petName}?`,
              [
                {
                  text: 'Não cancelar',
                  onPress: () => _doUnlink(pet, false),
                },
                {
                  text: 'Cancelar pagamentos', style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Agendamentos futuros',
                      `Deseja cancelar os agendamentos futuros de ${petName}?`,
                      [
                        {
                          text: 'Não cancelar',
                          onPress: () => _doUnlink(pet, true, false),
                        },
                        {
                          text: 'Cancelar agendamentos', style: 'destructive',
                          onPress: () => _doUnlink(pet, true, true),
                        },
                      ]
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const _doUnlink = async (pet: LinkedPet, cancelPayments: boolean, cancelSchedules?: boolean) => {
    try {
      const petId   = pet.pet_id;
      const walkerId = walkerProfile?.id ?? '';

      await supabase.from('walker_pet_links').update({ status: 'cancelled' }).eq('id', pet.id);

      if (cancelPayments) {
        await supabase.from('walker_payments')
          .update({ status: 'cancelled' })
          .eq('walker_id', walkerId)
          .eq('owner_id', pet.owner?.user_id ?? '')
          .eq('status', 'pending')
          .contains('pet_ids', [petId]);
      }

      if (cancelSchedules) {
        const now = new Date().toISOString();
        await supabase.from('walk_schedules')
          .update({ status: 'cancelled' })
          .eq('walker_id', walkerId)
          .eq('owner_id', pet.owner?.user_id ?? '')
          .in('status', ['confirmed', 'pending'])
          .gte('scheduled_at', now)
          .contains('pet_ids', [petId]);
      }

      if (pet.owner?.user_id) {
        const title = 'Pet desvinculado pelo walker';
        const body  = `${walkerProfile?.name ?? 'Seu walker'} encerrou o atendimento de ${pet.pet?.name ?? 'seu pet'}.`;
        await Promise.all([
          supabase.from('notifications').insert({
            user_id: pet.owner.user_id,
            type: 'pet_unlinked_by_walker', title, body,
            data: { pet_id: pet.pet?.id, walker_id: walkerId, pet_name: pet.pet?.name },
          }),
          sendPushToOwner(pet.owner.user_id, title, body, {
            type: 'pet_unlinked_by_walker', pet_id: pet.pet?.id, walker_id: walkerId,
          }),
        ]);
      }

      setPets((prev) => prev.filter((p) => p.id !== pet.id));
    } catch {
      Alert.alert('Erro', 'Não foi possível desvincular. Tente novamente.');
    }
  };

  const confirmAccept = async (pet: LinkedPet, serviceId: string | null) => {
    setRespondingId(pet.id);
    try {
      const { error } = await supabase
        .from('walker_pet_links')
        .update({ status: 'active', service_id: serviceId })
        .eq('id', pet.id);
      if (error) throw error;

      // Criar walker_payment pendente automaticamente se serviço foi escolhido
      if (serviceId && walkerProfile?.id && pet.owner?.user_id) {
        const svc = pendingAccept?.services.find((s) => s.id === serviceId);
        if (svc && svc.price > 0) {
          await supabase.from('walker_payments').insert({
            walker_id:    walkerProfile.id,
            owner_id:     pet.owner.user_id,
            pet_ids:      [pet.pet_id],
            service_type: svc.type,
            description:  svc.label,
            amount:       svc.price,
            billing_type: svc.billing_type,
            status:       'pending',
          });
        }
      }

      if (pet.owner?.user_id) {
        const title = 'Vínculo aceito!';
        const body  = `${walkerProfile?.name ?? 'Seu walker'} aceitou cuidar de ${pet.pet?.name ?? 'seu pet'}.`;
        await Promise.all([
          supabase.from('notifications').insert({
            user_id: pet.owner.user_id,
            type: 'pet_link_accepted', title, body,
            data: { pet_id: pet.pet?.id, walker_id: walkerProfile?.id },
          }),
          sendPushToOwner(pet.owner.user_id, title, body, {
            type: 'pet_link_accepted', pet_id: pet.pet?.id, walker_id: walkerProfile?.id,
          }),
        ]);
      }
      setPets((prev) => prev.map((p) => p.id === pet.id ? { ...p, status: 'active' } : p));
    } catch {
      Alert.alert('Erro', 'Não foi possível aceitar o vínculo.');
    } finally {
      setRespondingId(null);
      setPendingAccept(null);
    }
  };

  const respondToRequest = async (pet: LinkedPet, accept: boolean) => {
    setRespondingId(pet.id);
    try {
      if (accept) {
        // Verificar limite de pets vinculados por tutores
        const limits = getLimits(walkerProfile);
        const activePets = pets.filter((p) => p.status === 'active').length;
        if (activePets >= limits.linkedPets) {
          Alert.alert(
            'Limite atingido',
            `Você já tem ${activePets} pets vinculados. Entre em contato com o suporte para ampliar sua conta.`,
            [{ text: 'Entendido' }]
          );
          return;
        }

        // Verificar se o pet já tem vínculo ativo com outro walker
        const { data: existingLink } = await supabase
          .from('walker_pet_links')
          .select('id, walker_id')
          .eq('pet_id', pet.pet_id)
          .eq('status', 'active')
          .neq('walker_id', walkerProfile?.id ?? '')
          .maybeSingle();

        if (existingLink) {
          Alert.alert(
            'Pet já vinculado',
            `${pet.pet?.name ?? 'Este pet'} já possui um walker ativo. O tutor precisa desvincular o walker atual antes de vincular outro.`,
            [{ text: 'Entendido' }]
          );
          return;
        }

        // Buscar serviços ativos do walker para exibir no modal de escolha de plano
        const { data: services } = await supabase
          .from('walker_services')
          .select('id, type, label, price, billing_type')
          .eq('walker_id', walkerProfile?.id ?? '')
          .eq('active', true)
          .order('type');

        setRespondingId(null);

        if (!services || services.length === 0) {
          // Sem serviços cadastrados: aceita sem plano
          await confirmAccept(pet, null);
        } else {
          // Abre modal para o walker escolher o plano
          setPendingAccept({ pet, services: services as WalkerService[] });
        }
        return;
      } else {
        const { error } = await supabase
          .from('walker_pet_links')
          .delete()
          .eq('id', pet.id);
        if (error) throw error;

        if (pet.owner?.user_id) {
          const title = 'Solicitação recusada';
          const body  = `${walkerProfile?.name ?? 'Seu walker'} não pôde aceitar ${pet.pet?.name ?? 'seu pet'} no momento.`;
          await Promise.all([
            supabase.from('notifications').insert({
              user_id: pet.owner.user_id,
              type: 'pet_link_rejected', title, body,
              data: { pet_id: pet.pet?.id, walker_id: walkerProfile?.id },
            }),
            sendPushToOwner(pet.owner.user_id, title, body, {
              type: 'pet_link_rejected', pet_id: pet.pet?.id, walker_id: walkerProfile?.id,
            }),
          ]);
        }

        setPets((prev) => prev.filter((p) => p.id !== pet.id));
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível processar a solicitação.');
    } finally {
      setRespondingId(null);
    }
  };

  const fetchOwnPets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Pets ainda não mesclados (cadastrados pelo walker sem tutor ainda)
    const { data: unmerged } = await supabase
      .from('pets')
      .select('id,name,breed,photo_uri,species,gender,pet_link_code')
      .eq('walker_owner_id', user.id)
      .is('merged_into', null)
      .order('name');

    // Pets do walker que foram mesclados — buscar dados do pet do tutor no lugar
    const { data: mergedRows } = await supabase
      .from('pets')
      .select('merged_into')
      .eq('walker_owner_id', user.id)
      .not('merged_into', 'is', null);

    const mergedIds = (mergedRows ?? []).map((r: any) => r.merged_into).filter(Boolean);
    let mergedTutorPets: OwnPet[] = [];
    if (mergedIds.length > 0) {
      const { data: tutorPets } = await supabase
        .from('pets')
        .select('id,name,breed,photo_uri,species,gender')
        .in('id', mergedIds);
      mergedTutorPets = ((tutorPets ?? []) as OwnPet[]).map((p) => ({ ...p, isMerged: true }));
    }

    setOwnPets([...(unmerged as OwnPet[] ?? []), ...mergedTutorPets]);
  }, []);

  const deleteOwnPet = (pet: OwnPet) => {
    Alert.alert(
      'Remover pet',
      `Deseja remover ${pet.name} da sua lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('pets').delete().eq('id', pet.id);
            if (error) { Alert.alert('Erro', 'Não foi possível remover.'); return; }
            setOwnPets((prev) => prev.filter((p) => p.id !== pet.id));
          },
        },
      ]
    );
  };

  const fetchPets = useCallback(async () => {
    if (!walkerProfile) return;
    const { data, error } = await supabase
      .from('walker_pet_links')
      .select('id, walker_id, pet_id, owner_id, status, linked_at, pet:pets(id,name,breed,photo_uri,species,gender,dob,weight,castrated,microchip,food_allergies,med_allergies,restrictions)')
      .eq('walker_id', walkerProfile.id)
      .order('linked_at', { ascending: false });
    if (__DEV__ && error) console.warn('[PetsScreen] fetchPets error:', error);
    if (data) {
      const ownerIds = [...new Set(data.map((r: any) => r.owner_id).filter(Boolean))];
      let ownersMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('user_profiles')
          .select('user_id, name, avatar_url')
          .in('user_id', ownerIds);
        if (owners) owners.forEach((o: any) => { ownersMap[o.user_id] = o; });
      }
      setPets(data.map((r: any) => ({ ...r, owner: ownersMap[r.owner_id] ?? null })) as LinkedPet[]);
    } else {
      setPets([]);
    }
  }, [walkerProfile]);

  useEffect(() => {
    Promise.all([fetchPets(), fetchOwnPets()]).finally(() => setLoading(false));
  }, [fetchPets, fetchOwnPets]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPets(), fetchOwnPets()]);
    setRefreshing(false);
  };

  const pending = pets.filter((p) => p.status === 'pending');
  const filtered = filter === 'todos'
    ? pets.filter((p) => p.status !== 'pending')
    : pets.filter((p) => p.status === filter);
  const vinculados = pets.filter((p) => p.status === 'active').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Pets</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.addPetBtn}
            activeOpacity={0.8}
            onPress={() => {
              const limits = getLimits(walkerProfile);
              if (ownPets.length >= limits.ownPets) {
                Alert.alert(
                  'Limite atingido',
                  `Você já tem ${ownPets.length} pets cadastrados. Entre em contato com o suporte para ampliar sua conta.`,
                  [{ text: 'Entendido' }]
                );
                return;
              }
              router.push('/pets/add');
            }}
          >
            <Ionicons name="add" size={16} color={Colors.primary} />
            <Text style={styles.addPetBtnText}>Cadastrar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteBtn} onPress={() => router.push('/invite')} activeOpacity={0.8}>
            <Ionicons name="ticket-outline" size={16} color={Colors.primary} />
            <Text style={styles.inviteBtnText}>Convidar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Solicitações pendentes */}
          {pending.length > 0 && (
            <View style={styles.pendingSection}>
              <View style={styles.pendingHeader}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingTitle}>SOLICITAÇÕES PENDENTES ({pending.length})</Text>
              </View>
              {pending.map((pet) => (
                <View key={pet.id} style={styles.pendingCard}>
                  <View style={styles.pendingPetInfo}>
                    <View style={styles.petAvatar}>
                      <Ionicons name="paw" size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingPetName}>{pet.pet?.name ?? '—'}</Text>
                      <Text style={styles.pendingPetMeta}>
                        {pet.pet?.breed ?? 'Raça não informada'}
                        {pet.owner?.name ? ` · ${pet.owner.name}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => respondToRequest(pet, false)}
                      disabled={respondingId === pet.id}
                      activeOpacity={0.8}
                    >
                      {respondingId === pet.id
                        ? <ActivityIndicator size="small" color={Colors.error} />
                        : <Ionicons name="close" size={18} color={Colors.error} />
                      }
                      <Text style={styles.rejectBtnText}>Recusar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => respondToRequest(pet, true)}
                      disabled={respondingId === pet.id}
                      activeOpacity={0.8}
                    >
                      {respondingId === pet.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="checkmark" size={18} color="#fff" />
                      }
                      <Text style={styles.acceptBtnText}>Aceitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Tabs filtro */}
          <View style={styles.tabs}>
            {(['todos', 'active'] as FilterTab[]).map((tab) => {
              const labels = { todos: 'Todos', active: 'Ativos' };
              return (
                <TouchableOpacity key={tab} style={[styles.tab, filter === tab && styles.tabActive]} onPress={() => setFilter(tab)}>
                  <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>{labels[tab]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Meus pets (cadastrados pelo walker) */}
          {ownPets.length > 0 && (
            <View style={styles.ownSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="paw" size={14} color={Colors.primary} />
                <Text style={styles.sectionTitle}>MEUS PETS ({ownPets.length})</Text>
              </View>
              {ownPets.map((pet) => (
                <TouchableOpacity
                  key={pet.id} style={styles.ownCard}
                  onPress={() => setSelectedOwnPet(pet)} activeOpacity={0.75}
                >
                  <View style={styles.petAvatar}>
                    <Ionicons name="paw" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.pendingPetName}>{pet.name}</Text>
                    <Text style={styles.pendingPetMeta}>
                      {pet.breed ?? 'Raça não informada'}
                      {pet.species ? ` · ${pet.species === 'dog' ? 'Cão' : pet.species === 'cat' ? 'Gato' : 'Outro'}` : ''}
                    </Text>
                    {pet.isMerged ? (
                      <Text style={styles.ownMergedBadge}>Vinculado ao tutor</Text>
                    ) : pet.pet_link_code ? (
                      <Text style={styles.ownCode}>{pet.pet_link_code}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Lista de pets vinculados (ativos/todos) */}
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={14} color={Colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>
              VINCULADOS POR TUTORES ({filtered.length})
            </Text>
          </View>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="paw-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>Nenhum pet vinculado</Text>
              <Text style={styles.emptyText}>Quando um tutor vincular um pet e você aceitar, ele aparecerá aqui.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((item) => (
                <PetCard key={item.id} item={item} onPress={setSelectedPet} onUnlink={unlinkPet} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal de seleção de plano ao aceitar vínculo */}
      <Modal visible={!!pendingAccept} transparent animationType="fade" onRequestClose={() => setPendingAccept(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Escolha o plano</Text>
            <Text style={styles.modalSubtitle}>
              Qual serviço se aplica a {pendingAccept?.pet.pet?.name ?? 'este pet'}?
            </Text>
            <View style={styles.modalServices}>
              {pendingAccept?.services.map((svc) => (
                <TouchableOpacity
                  key={svc.id}
                  style={styles.serviceOption}
                  onPress={() => confirmAccept(pendingAccept.pet, svc.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceLabel}>{svc.label}</Text>
                    <Text style={styles.serviceBilling}>
                      {svc.billing_type === 'monthly' ? 'Mensal' :
                       svc.billing_type === 'per_session' ? 'Por sessão' : svc.billing_type}
                    </Text>
                  </View>
                  <Text style={styles.servicePrice}>
                    R$ {Number(svc.price).toFixed(2).replace('.', ',')}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.serviceOption, styles.serviceOptionNone]}
                onPress={() => confirmAccept(pendingAccept!.pet, null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.serviceLabel, { color: Colors.textSecondary }]}>Sem plano definido</Text>
                <Text style={[styles.servicePrice, { color: Colors.textSecondary }]}>—</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setPendingAccept(null)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <OwnPetModal pet={selectedOwnPet} onClose={() => setSelectedOwnPet(null)} />
      <PetDetailModal pet={selectedPet} onClose={() => setSelectedPet(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: `${Colors.primary}18`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${Colors.primary}15`, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: `${Colors.primary}30`,
  },
  inviteBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  scrollContent: { paddingBottom: 32 },

  // Pending
  pendingSection: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#FEF3C718', borderRadius: 16,
    borderWidth: 1, borderColor: '#F59E0B30',
    overflow: 'hidden',
  },
  pendingHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F59E0B20',
  },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  pendingTitle: { fontSize: 11, fontWeight: '700', color: '#F59E0B', letterSpacing: 0.8 },
  pendingCard: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F59E0B15',
    gap: 12,
  },
  pendingPetInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  petAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  pendingPetName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  pendingPetMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  pendingActions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 10,
    borderWidth: 1.5, borderColor: `${Colors.error}40`,
    backgroundColor: `${Colors.error}08`,
  },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: Colors.error },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 10,
    backgroundColor: Colors.primary,
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Tabs
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12, marginTop: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  addPetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${Colors.primary}15`, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: `${Colors.primary}30`,
  },
  addPetBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Own pets section
  ownSection: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, marginBottom: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8 },
  ownCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  ownDeleteBtn: { padding: 6 },
  ownCode: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 2 },
  ownMergedBadge: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },

  // List
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40, paddingTop: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 20, gap: 12 },

  // Modal de seleção de plano
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    width: '100%', backgroundColor: Colors.card,
    borderRadius: 20, padding: 24, gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  modalServices: { gap: 8 },
  serviceOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  serviceOptionNone: { borderStyle: 'dashed', borderColor: Colors.border },
  serviceLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  serviceBilling: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  servicePrice: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  modalCancel: { alignItems: 'center', paddingVertical: 8 },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
});
