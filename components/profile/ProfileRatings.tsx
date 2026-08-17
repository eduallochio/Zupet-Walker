import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';

type Rating = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  owner_name: string | null;
};

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= Math.round(value) ? 'star' : 'star-outline'}
          size={size}
          color="#FFD700"
        />
      ))}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function ProfileRatings() {
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!walkerProfile?.id) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('walker_ratings')
        .select('id, rating, comment, created_at, owner_id')
        .eq('walker_id', walkerProfile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!active || !data) { setLoading(false); return; }

      const ownerIds = [...new Set(data.map((r: any) => r.owner_id).filter(Boolean))];
      let namesMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, name')
          .in('user_id', ownerIds);
        if (profiles) profiles.forEach((p: any) => { namesMap[p.user_id] = p.name; });
      }

      setRatings(data.map((r: any) => ({ ...r, owner_name: namesMap[r.owner_id] ?? null })));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [walkerProfile?.id]));

  const avg = walkerProfile?.rating;
  const displayed = showAll ? ratings : ratings.slice(0, 3);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Avaliações</Text>
        {avg != null && (
          <View style={styles.avgBadge}>
            <Ionicons name="star" size={13} color="#FFD700" />
            <Text style={styles.avgText}>{avg.toFixed(1)}</Text>
            <Text style={styles.avgCount}>({ratings.length})</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
      ) : ratings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="star-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>Nenhuma avaliação ainda. Conclua passeios para receber avaliações dos tutores.</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            {displayed.map((r, i) => (
              <View key={r.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.ratingItem}>
                  <View style={styles.ratingTop}>
                    <View style={styles.avatarCircle}>
                      <Ionicons name="person" size={14} color={Colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ownerName}>{r.owner_name ?? 'Tutor'}</Text>
                      <Text style={styles.ratingDate}>{formatDate(r.created_at)}</Text>
                    </View>
                    <StarRow value={r.rating} />
                  </View>
                  {r.comment ? (
                    <Text style={styles.comment}>"{r.comment}"</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {ratings.length > 3 && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAll((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.showMoreText}>{showAll ? 'Ver menos' : `Ver todas (${ratings.length})`}</Text>
              <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  avgBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFD70018', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  avgText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  avgCount: { fontSize: 12, color: Colors.textSecondary },
  starRow: { flexDirection: 'row', gap: 2 },

  card: { backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },
  ratingItem: { padding: 14, gap: 8 },
  ratingTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: `${Colors.textSecondary}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  ownerName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  ratingDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  comment: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic', marginLeft: 42 },

  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  emptyText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  showMoreText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});
