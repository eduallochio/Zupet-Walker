import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import ServiceModal, {
  type WalkerService, type ServiceForm, type ServiceType,
  SERVICE_CATALOG, defaultForm, formatDuration,
} from '../../components/services/ServiceModal';

export default function ServicesScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);

  const [services, setServices] = useState<WalkerService[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<(WalkerService & { isNew?: boolean }) | null>(null);
  const [showPrices, setShowPrices] = useState<boolean>((walkerProfile as any)?.show_prices ?? true);
  const [savingPrices, setSavingPrices] = useState(false);

  const fetchServices = useCallback(async () => {
    if (!walkerProfile) return;
    const { data } = await supabase
      .from('walker_services')
      .select('*')
      .eq('walker_id', walkerProfile.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setServices((data ?? []) as WalkerService[]);
  }, [walkerProfile]);

  useEffect(() => { fetchServices().finally(() => setLoading(false)); }, [fetchServices]);

  const openNew = (type: ServiceType) => {
    setEditingService({ ...defaultForm(type), id: '', walker_id: walkerProfile!.id, isNew: true, blocked_slots: {} } as any);
    setModalVisible(true);
  };

  const openEdit = (svc: WalkerService) => {
    setEditingService(svc);
    setModalVisible(true);
  };

  const handleSave = async (form: ServiceForm, id?: string) => {
    if (!walkerProfile) return;
    const payload = {
      type:             form.type,
      label:            form.label,
      description:      form.description,
      price:            form.price,
      price_daily:      form.price_daily,
      price_weekly:     form.price_weekly,
      price_biweekly:   form.price_biweekly,
      price_monthly:    form.price_monthly,
      duration_minutes: form.duration_minutes,
      max_pets:         form.max_pets,
      active:           form.active,
      sort_order:       form.sort_order,
      available_slots:  form.available_slots,
    };
    try {
      if (!id) {
        const { error } = await supabase.from('walker_services').insert({
          ...payload,
          walker_id:  walkerProfile.id,
          sort_order: services.length,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('walker_services')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }
      await fetchServices();
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar o serviço.');
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('walker_services').delete().eq('id', id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleActive = async (svc: WalkerService) => {
    const newVal = !svc.active;
    await supabase.from('walker_services').update({ active: newVal }).eq('id', svc.id);
    setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, active: newVal } : s));
  };

  const cat = (type: ServiceType) => SERVICE_CATALOG.find((c) => c.type === type) ?? SERVICE_CATALOG[0];

  const toggleShowPrices = async (val: boolean) => {
    if (!walkerProfile) return;
    setShowPrices(val);
    setSavingPrices(true);
    await supabase
      .from('walker_profiles')
      .update({ show_prices: val })
      .eq('id', walkerProfile.id);
    setSavingPrices(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Meus Serviços</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Configuração de visibilidade de preços */}
          <View style={styles.visibilityCard}>
            <View style={styles.visibilityInfo}>
              <Ionicons name="eye-outline" size={20} color={showPrices ? Colors.primary : Colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.visibilityTitle}>Mostrar preços publicamente</Text>
                <Text style={styles.visibilityDesc}>
                  {showPrices
                    ? 'Os preços aparecem na landing page e no perfil público.'
                    : 'Os preços ficam ocultos — tutores precisam entrar em contato.'}
                </Text>
              </View>
            </View>
            <Switch
              value={showPrices}
              onValueChange={toggleShowPrices}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor="#fff"
              disabled={savingPrices}
              style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
            />
          </View>

          {/* Serviços cadastrados */}
          {services.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SEUS SERVIÇOS</Text>
              <View style={styles.serviceList}>
                {services.map((svc) => {
                  const c = cat(svc.type);
                  const slotDayCount = Object.keys(svc.available_slots ?? {}).length;
                  const totalSlots = Object.values(svc.available_slots ?? {}).reduce((s, arr) => s + arr.length, 0);
                  return (
                    <View key={svc.id} style={[styles.serviceCard, !svc.active && styles.serviceCardInactive]}>
                      <TouchableOpacity style={styles.serviceCardInner} onPress={() => openEdit(svc)} activeOpacity={0.8}>
                        <View style={styles.serviceCardLeft}>
                          <Text style={styles.serviceIcon}>{c.icon}</Text>
                        </View>
                        <View style={styles.serviceCardBody}>
                          <View style={styles.serviceCardTop}>
                            <Text style={[styles.serviceCardName, !svc.active && { color: Colors.textSecondary }]}>
                              {svc.label}
                            </Text>
                          </View>
                          <View style={styles.serviceCardPrices}>
                            {([
                              { val: svc.price,          short: '/sessão'   },
                              { val: svc.price_daily,     short: '/dia'      },
                              { val: svc.price_weekly,    short: '/semana'   },
                              { val: svc.price_biweekly,  short: '/quinzena' },
                              { val: svc.price_monthly,   short: '/mês'      },
                            ] as { val: number; short: string }[])
                              .filter((p) => p.val > 0)
                              .map((p) => (
                                <View key={p.short} style={styles.priceTag}>
                                  <Text style={styles.priceTagText}>
                                    R$ {p.val.toFixed(2).replace('.', ',')}{p.short}
                                  </Text>
                                </View>
                              ))
                            }
                          </View>
                          <View style={styles.serviceCardMeta}>
                            <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                            <Text style={styles.serviceCardMetaText}>{formatDuration(svc.duration_minutes)}</Text>
                            <Text style={styles.serviceCardMetaDot}>·</Text>
                            <Ionicons name="paw-outline" size={12} color={Colors.textSecondary} />
                            <Text style={styles.serviceCardMetaText}>máx. {svc.max_pets} pet{svc.max_pets !== 1 ? 's' : ''}</Text>
                          </View>
                          {slotDayCount > 0 ? (
                            <View style={styles.serviceCardMeta}>
                              <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                              <Text style={styles.serviceCardMetaText}>
                                {slotDayCount} dia{slotDayCount !== 1 ? 's' : ''} · {totalSlots} horário{totalSlots !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.serviceCardMeta}>
                              <Ionicons name="alert-circle-outline" size={12} color={Colors.warning} />
                              <Text style={[styles.serviceCardMetaText, { color: Colors.warning }]}>Sem horários configurados</Text>
                            </View>
                          )}
                          {svc.description ? (
                            <Text style={styles.serviceCardDesc} numberOfLines={1}>{svc.description}</Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.border} style={{ alignSelf: 'center' }} />
                      </TouchableOpacity>

                      <View style={[styles.activeToggleRow, { borderTopColor: Colors.border }]}>
                        <TouchableOpacity
                          style={styles.blockDatesBtn}
                          onPress={() => router.push(`/availability?service_id=${svc.id}` as any)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
                          <Text style={styles.blockDatesBtnText}>Bloquear datas</Text>
                        </TouchableOpacity>
                        <View style={styles.activeToggleRight}>
                          <Text style={{ fontSize: 12, color: svc.active ? Colors.success : Colors.textSecondary, fontWeight: '600' }}>
                            {svc.active ? 'Ativo' : 'Inativo'}
                          </Text>
                          <Switch
                            value={svc.active}
                            onValueChange={() => toggleActive(svc)}
                            trackColor={{ true: Colors.primary }}
                            thumbColor="#fff"
                            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Adicionar serviço */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADICIONAR SERVIÇO</Text>
            <View style={styles.catalogGrid}>
              {SERVICE_CATALOG.map((c) => {
                const already = services.some((s) => s.type === c.type);
                return (
                  <TouchableOpacity
                    key={c.type}
                    style={[styles.catalogCard, already && styles.catalogCardDim]}
                    onPress={() => openNew(c.type)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.catalogIcon}>{c.icon}</Text>
                    <Text style={styles.catalogLabel}>{c.label}</Text>
                    {already && (
                      <View style={styles.catalogBadge}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.catalogHint}>
              Você pode adicionar múltiplos horários do mesmo serviço com configurações diferentes.
            </Text>
          </View>

        </ScrollView>
      )}

      <ServiceModal
        visible={modalVisible}
        initial={editingService}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  scroll: { padding: 20, gap: 28, paddingBottom: 48 },

  section: { gap: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },

  serviceList: { gap: 12 },
  serviceCard: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  serviceCardInactive: { opacity: 0.65 },
  serviceCardInner: { flexDirection: 'row', padding: 14, gap: 12 },
  serviceCardLeft: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceIcon: { fontSize: 22 },
  serviceCardBody: { flex: 1, gap: 5 },
  serviceCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceCardName: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  serviceCardPrices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  priceTag: {
    backgroundColor: `${Colors.primary}15`, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  priceTagText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  serviceCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  serviceCardMetaText: { fontSize: 11, color: Colors.textSecondary },
  serviceCardMetaDot: { fontSize: 11, color: Colors.border },
  serviceCardDesc: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },

  activeToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, gap: 10,
  },
  activeToggleRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockDatesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: Colors.primary + '10', borderWidth: 1, borderColor: Colors.primary + '30',
  },
  blockDatesBtnText: { fontSize: 11, fontWeight: '600', color: Colors.primary },

  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catalogCard: {
    width: '30%', paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 6, position: 'relative',
  },
  catalogCardDim: { borderColor: `${Colors.primary}40`, backgroundColor: `${Colors.primary}08` },
  catalogIcon: { fontSize: 26 },
  catalogLabel: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  catalogBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center',
  },
  catalogHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  visibilityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  visibilityInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  visibilityTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  visibilityDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
