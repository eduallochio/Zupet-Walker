import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';

type ServiceSummary = { id: string; type: string; label: string; price: number; active: boolean };

const CATALOG_ICONS: Record<string, string> = {
  walk: '🦮', daycare: '🏠', boarding: '🌙',
  training: '🎯', bath: '🛁', vet_visit: '🏥',
};

export function ProfileServices() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walkerProfile?.id) { setLoading(false); return; }
    supabase
      .from('walker_services')
      .select('id, type, label, price, active')
      .eq('walker_id', walkerProfile.id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setServices((data ?? []) as ServiceSummary[]);
        setLoading(false);
      });
  }, [walkerProfile?.id]);

  const activeCount = services.filter((s) => s.active).length;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Meus Serviços</Text>
        <TouchableOpacity onPress={() => router.push('/services')} style={styles.manageBtn} activeOpacity={0.8}>
          <Text style={styles.manageBtnText}>Gerenciar</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
      ) : services.length === 0 ? (
        <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/services')} activeOpacity={0.8}>
          <Text style={styles.emptyIcon}>🦮</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>Nenhum serviço cadastrado</Text>
            <Text style={styles.emptySub}>Configure passeios, creche, hospedagem e mais</Text>
          </View>
          <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipNum}>{services.length}</Text>
              <Text style={styles.summaryChipLabel}>cadastrado{services.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={[styles.summaryChip, { borderColor: `${Colors.success}40`, backgroundColor: `${Colors.success}08` }]}>
              <Text style={[styles.summaryChipNum, { color: Colors.success }]}>{activeCount}</Text>
              <Text style={[styles.summaryChipLabel, { color: Colors.success }]}>ativo{activeCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          <View style={styles.serviceList}>
            {services.slice(0, 4).map((svc) => (
              <TouchableOpacity key={svc.id} style={[styles.serviceRow, !svc.active && styles.serviceRowInactive]}
                onPress={() => router.push('/services')} activeOpacity={0.8}>
                <Text style={styles.serviceRowIcon}>{CATALOG_ICONS[svc.type] ?? '🐾'}</Text>
                <Text style={[styles.serviceRowLabel, !svc.active && { color: Colors.textSecondary }]} numberOfLines={1}>
                  {svc.label}
                </Text>
                <Text style={styles.serviceRowPrice}>
                  R$ {svc.price.toFixed(2).replace('.', ',')}
                </Text>
                {!svc.active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>inativo</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {services.length > 4 && (
              <TouchableOpacity style={styles.moreRow} onPress={() => router.push('/services')} activeOpacity={0.8}>
                <Text style={styles.moreText}>+{services.length - 4} mais serviços</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 14,
  },
  emptyIcon: { fontSize: 26 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary}08`, borderRadius: 12,
    borderWidth: 1, borderColor: `${Colors.primary}30`, padding: 10,
  },
  summaryChipNum: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  summaryChipLabel: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  serviceList: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  serviceRowInactive: { opacity: 0.55 },
  serviceRowIcon: { fontSize: 18 },
  serviceRowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  serviceRowPrice: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  inactiveBadge: {
    backgroundColor: `${Colors.textSecondary}18`, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  inactiveBadgeText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  moreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 12,
  },
  moreText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
