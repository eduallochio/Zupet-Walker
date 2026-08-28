import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import NotificationItem, { NotificationData } from '../components/notifications/NotificationItem';

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems]       = useState<NotificationData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data ?? []) as NotificationData[]);
  }, []);

  const initialLoad = useRef(true);
  useEffect(() => { fetchNotifs().finally(() => setLoading(false)); }, [fetchNotifs]);
  useFocusEffect(useCallback(() => {
    if (initialLoad.current) { initialLoad.current = false; return; }
    fetchNotifs();
  }, [fetchNotifs]));

  const onRefresh = async () => { setRefreshing(true); await fetchNotifs(); setRefreshing(false); };

  const markRead = async (item: NotificationData) => {
    if (item.read_at) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
    setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n));

    // Navegar para tela relevante conforme tipo
    if (item.type === 'service_requested') {
      router.push('/(tabs)/agenda' as any);
    }
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    const ids = unread.map((n) => n.id);
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notificações</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.headerBtn}>
            <Text style={styles.markAllText}>Todas lidas</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Ionicons name="mail-unread-outline" size={15} color={Colors.primary} />
          <Text style={styles.unreadBannerText}>
            {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => <NotificationItem item={item} onPress={markRead} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>Sem notificações</Text>
              <Text style={styles.emptyText}>Novos agendamentos e atualizações aparecerão aqui.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerBtn: { width: 80, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  markAllText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  unreadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: `${Colors.primary}12`,
    borderBottomWidth: 1, borderBottomColor: `${Colors.primary}20`,
  },
  unreadBannerText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
