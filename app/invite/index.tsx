import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Share, Alert, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Share as RNShare } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/colors';

type InviteCode = {
  id: string;
  code: string;
  expires_at: string;
  used_count: number;
  max_uses: number;
  created_at: string;
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date();
}

function formatExpiry(expiresAt: string) {
  const d = new Date(expiresAt);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function InviteScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCodes = useCallback(async () => {
    if (!walkerProfile) return;
    const { data } = await supabase
      .from('walker_invite_codes')
      .select('*')
      .eq('walker_id', walkerProfile.id)
      .order('created_at', { ascending: false });
    setCodes((data ?? []) as InviteCode[]);
  }, [walkerProfile]);

  useEffect(() => {
    fetchCodes().finally(() => setLoading(false));
  }, [fetchCodes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCodes();
    setRefreshing(false);
  };

  const createCode = async () => {
    if (!walkerProfile) return;
    setCreating(true);
    try {
      let code = generateCode();
      // Garante unicidade tentando até 3 vezes
      for (let i = 0; i < 3; i++) {
        const { data: existing } = await supabase
          .from('walker_invite_codes')
          .select('id')
          .eq('code', code)
          .maybeSingle();
        if (!existing) break;
        code = generateCode();
      }
      const { error } = await supabase.from('walker_invite_codes').insert({
        walker_id: walkerProfile.id,
        code,
      });
      if (error) throw error;
      await fetchCodes();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível gerar o código.');
    } finally {
      setCreating(false);
    }
  };

  const shareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Use o código **${code}** no app Zupet para vincular seus pets a mim como walker!\n\nCódigo válido por 7 dias.`,
        title: 'Código de convite Zupet Walker',
      });
    } catch {}
  };

  const revokeCode = (id: string, code: string) => {
    Alert.alert(
      'Revogar código',
      `Tem certeza que deseja revogar o código ${code}? Tutores não poderão mais usá-lo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('walker_invite_codes').delete().eq('id', id);
            await fetchCodes();
          },
        },
      ]
    );
  };

  const activeCodes = codes.filter((c) => !isExpired(c.expires_at) && c.used_count < c.max_uses);
  const expiredCodes = codes.filter((c) => isExpired(c.expires_at) || c.used_count >= c.max_uses);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Códigos de Convite</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Explicação */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Gere um código e envie para o tutor. Ele digita no app Zupet para vincular os pets a você.
            Cada código é válido por 7 dias e pode ser usado até 10 vezes.
          </Text>
        </View>

        {/* Botão gerar */}
        <TouchableOpacity
          style={[styles.generateBtn, creating && { opacity: 0.7 }]}
          onPress={createCode}
          disabled={creating}
          activeOpacity={0.85}
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.generateBtnText}>Gerar novo código</Text>
            </>
          )}
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Códigos ativos */}
            {activeCodes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ativos</Text>
                {activeCodes.map((item) => (
                  <View key={item.id} style={styles.codeCard}>
                    <View style={styles.codeTop}>
                      <Text style={styles.codeText}>{item.code}</Text>
                      <View style={styles.codeActions}>
                        <TouchableOpacity onPress={() => shareCode(item.code)} style={styles.iconBtn}>
                          <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => revokeCode(item.id, item.code)} style={styles.iconBtn}>
                          <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.codeMeta}>
                      <Text style={styles.codeMetaText}>
                        Expira em {formatExpiry(item.expires_at)}
                      </Text>
                      <Text style={styles.codeMetaText}>
                        {item.used_count}/{item.max_uses} usos
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Estado vazio */}
            {activeCodes.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="ticket-outline" size={48} color={Colors.border} />
                <Text style={styles.emptyTitle}>Nenhum código ativo</Text>
                <Text style={styles.emptyText}>Gere um código acima e compartilhe com o tutor.</Text>
              </View>
            )}

            {/* Códigos expirados/esgotados */}
            {expiredCodes.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>Expirados / Esgotados</Text>
                {expiredCodes.map((item) => (
                  <View key={item.id} style={[styles.codeCard, styles.codeCardExpired]}>
                    <View style={styles.codeTop}>
                      <Text style={[styles.codeText, { color: Colors.textSecondary }]}>{item.code}</Text>
                      <TouchableOpacity onPress={() => revokeCode(item.id, item.code)} style={styles.iconBtn}>
                        <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.codeMeta}>
                      <Text style={styles.codeMetaText}>
                        {isExpired(item.expires_at) ? `Expirou em ${formatExpiry(item.expires_at)}` : 'Esgotado'}
                      </Text>
                      <Text style={styles.codeMetaText}>{item.used_count} usos</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
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
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  infoCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: `${Colors.primary}12`, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: `${Colors.primary}25`,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
  },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  codeCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  codeCardExpired: { opacity: 0.6 },
  codeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: 4 },
  codeActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  codeMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  codeMetaText: { fontSize: 12, color: Colors.textSecondary },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
});
