import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

export function ProfilePaymentsCard() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);

  useEffect(() => {
    if (!walkerProfile) return;
    supabase
      .from('walker_payments')
      .select('amount')
      .eq('walker_id', walkerProfile.id)
      .eq('status', 'pending')
      .then(({ data }) => {
        const rows = data ?? [];
        setPendingCount(rows.length);
        setPendingAmount(rows.reduce((s: number, r: any) => s + (r.amount ?? 0), 0));
      });
  }, [walkerProfile]);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/payments' as any)}
        activeOpacity={0.8}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="cash-outline" size={22} color={Colors.primary} />
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>Pagamentos</Text>
          <Text style={styles.sub}>
            {pendingCount > 0
              ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''} · R$ ${pendingAmount.toFixed(2).replace('.', ',')}`
              : 'Nenhum pagamento pendente'}
          </Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 12, color: Colors.textSecondary },
  badge: {
    backgroundColor: '#F59E0B', borderRadius: 20,
    minWidth: 22, height: 22, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
});
