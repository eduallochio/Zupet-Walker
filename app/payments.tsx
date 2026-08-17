import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';

type Payment = {
  id: string;
  owner_id: string;
  service_type?: string;
  description?: string;
  amount: number;
  billing_type: string;
  period_ref?: string;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at?: string;
  notes?: string;
  created_at: string;
  owner_name?: string;
};

const BILLING_LABEL: Record<string, string> = {
  per_session: 'Por sessão',
  daily:       'Diário',
  weekly:      'Semanal',
  biweekly:    'Quinzenal',
  monthly:     'Mensal',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   '#F59E0B',
  paid:      '#10B981',
  cancelled: Colors.textSecondary,
};

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendente',
  paid:      'Pago',
  cancelled: 'Cancelado',
};

function formatCurrency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function monthLabel(ref: string) {
  const [y, m] = ref.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function PaymentsScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'pending' | 'paid' | 'all'>('pending');

  const fetchPayments = useCallback(async () => {
    if (!walkerProfile) return;

    const { data } = await supabase
      .from('walker_payments')
      .select('*')
      .eq('walker_id', walkerProfile.id)
      .order('created_at', { ascending: false });

    const raw = (data ?? []) as Payment[];
    const ownerIds = [...new Set(raw.map((p) => p.owner_id))];
    let namesMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from('user_profiles').select('user_id,name').in('user_id', ownerIds);
      (owners ?? []).forEach((o: any) => { namesMap[o.user_id] = o.name; });
    }
    setPayments(raw.map((p) => ({ ...p, owner_name: namesMap[p.owner_id] ?? '—' })));
  }, [walkerProfile]);

  useEffect(() => { fetchPayments().finally(() => setLoading(false)); }, [fetchPayments]);
  const onRefresh = async () => { setRefreshing(true); await fetchPayments(); setRefreshing(false); };

  const markPaid = (payment: Payment) => {
    Alert.alert(
      'Confirmar recebimento',
      `Marcar ${formatCurrency(payment.amount)} como recebido?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const paidAt = new Date().toISOString();
            const { error } = await supabase.from('walker_payments')
              .update({ status: 'paid', paid_at: paidAt })
              .eq('id', payment.id);
            if (error) { Alert.alert('Erro', error.message); return; }

            await supabase.from('notifications').insert({
              user_id: payment.owner_id,
              type:    'payment_confirmed',
              title:   'Pagamento confirmado',
              body:    `${walkerProfile?.name ?? 'Seu walker'} confirmou o recebimento de ${formatCurrency(payment.amount)}.`,
              data:    { payment_id: payment.id },
            });

            setPayments((prev) => prev.map((p) =>
              p.id === payment.id ? { ...p, status: 'paid', paid_at: paidAt } : p
            ));
          },
        },
      ]
    );
  };

  const cancelPayment = (id: string) => {
    Alert.alert('Cancelar cobrança', 'Tem certeza?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar cobrança', style: 'destructive',
        onPress: async () => {
          await supabase.from('walker_payments').update({ status: 'cancelled' }).eq('id', id);
          setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status: 'cancelled' } : p));
        },
      },
    ]);
  };

  const filtered = payments.filter((p) => tab === 'all' ? true : p.status === tab);
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const totalPaid    = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Pagamentos</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Resumo */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: '#F59E0B40' }]}>
            <Ionicons name="time-outline" size={18} color="#F59E0B" />
            <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{formatCurrency(totalPending)}</Text>
            <Text style={styles.summaryLabel}>A receber</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#10B98140' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>{formatCurrency(totalPaid)}</Text>
            <Text style={styles.summaryLabel}>Recebido</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            As cobranças são geradas automaticamente quando um tutor contratar seu serviço. Marque como pago após receber.
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['pending', 'paid', 'all'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && { color: '#fff' }]}>
                {t === 'pending' ? 'Pendentes' : t === 'paid' ? 'Pagos' : 'Todos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cash-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>Nenhuma cobrança</Text>
            <Text style={styles.emptyText}>
              {tab === 'pending'
                ? 'Nenhum pagamento pendente. Quando um tutor contratar seu serviço, a cobrança aparecerá aqui.'
                : 'Nenhum registro encontrado.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((payment) => (
              <View key={payment.id} style={[styles.card, { borderLeftColor: STATUS_COLOR[payment.status] }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardDesc}>{payment.description ?? payment.service_type ?? '—'}</Text>
                    <Text style={styles.cardOwner}>{payment.owner_name}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[styles.cardAmount, { color: STATUS_COLOR[payment.status] }]}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <View style={[styles.statusChip, { backgroundColor: STATUS_COLOR[payment.status] + '25' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[payment.status] }]}>
                        {STATUS_LABEL[payment.status]}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaText}>
                    {BILLING_LABEL[payment.billing_type] ?? payment.billing_type}
                    {payment.period_ref ? ` · ${monthLabel(payment.period_ref)}` : ''}
                  </Text>
                  <Text style={styles.cardMetaText}>
                    {payment.status === 'paid' && payment.paid_at
                      ? `Pago em ${formatDate(payment.paid_at)}`
                      : `Gerado em ${formatDate(payment.created_at)}`}
                  </Text>
                </View>

                {payment.notes ? (
                  <Text style={styles.cardNotes}>{payment.notes}</Text>
                ) : null}

                {payment.status === 'pending' && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#10B98115', borderColor: '#10B98135' }]}
                      onPress={() => markPaid(payment)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={15} color="#10B981" />
                      <Text style={[styles.actionText, { color: '#10B981' }]}>Marcar como pago</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#EF444415', borderColor: '#EF444435' }]}
                      onPress={() => cancelPayment(payment.id)}
                    >
                      <Ionicons name="close-circle-outline" size={15} color="#EF4444" />
                      <Text style={[styles.actionText, { color: '#EF4444' }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 14, paddingTop: 16 },

  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, borderRadius: 16, borderWidth: 1, padding: 16,
    alignItems: 'center', gap: 6, backgroundColor: Colors.card,
  },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoText: { fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 17 },

  tabs: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1, borderRadius: 20, paddingVertical: 8, alignItems: 'center',
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  list: { gap: 12 },
  card: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 4, padding: 14, gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardDesc: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardOwner: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardAmount: { fontSize: 16, fontWeight: '800' },
  statusChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMetaText: { fontSize: 11, color: Colors.textSecondary },
  cardNotes: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: 10, borderWidth: 1, paddingVertical: 8,
  },
  actionText: { fontSize: 12, fontWeight: '700' },

  empty: { marginTop: 32, alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
