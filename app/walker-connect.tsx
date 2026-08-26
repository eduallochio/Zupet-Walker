import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Share, Alert, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';

type SocialLinks = {
  instagram?: string; tiktok?: string; youtube?: string;
  linkedin?: string; facebook?: string; whatsapp?: string;
};

const SOCIAL_CONFIG: { key: keyof SocialLinks; icon: string; color: string; prefix: string; isPhone?: boolean }[] = [
  { key: 'instagram', icon: 'logo-instagram', color: '#E1306C', prefix: 'https://instagram.com/' },
  { key: 'tiktok',   icon: 'logo-tiktok',    color: '#010101', prefix: 'https://tiktok.com/@' },
  { key: 'youtube',  icon: 'logo-youtube',   color: '#FF0000', prefix: 'https://youtube.com/@' },
  { key: 'linkedin', icon: 'logo-linkedin',  color: '#0077B5', prefix: 'https://linkedin.com/in/' },
  { key: 'facebook', icon: 'logo-facebook',  color: '#1877F2', prefix: 'https://facebook.com/' },
  { key: 'whatsapp', icon: 'logo-whatsapp',  color: '#25D366', prefix: 'https://wa.me/', isPhone: true },
];

function formatPrice(value: number | string | null): string {
  if (value == null) return 'Consultar';
  const n = Number(value);
  if (isNaN(n)) return 'Consultar';
  return n % 1 === 0 ? `R$ ${n.toFixed(0)}` : `R$ ${n.toFixed(2).replace('.', ',')}`;
}

type InviteCode = {
  id: string;
  code: string;
  expires_at: string;
  used_count: number;
  max_uses: number;
  created_at: string;
};

type LinkedPet = {
  id: string;
  status: string;
  linked_at: string;
  pet: { id: string; name: string; breed?: string } | null;
  owner: { user_id: string; name: string; avatar_url?: string } | null;
};

type WalkerService = {
  id: string; type: string; label: string; price: number | null; price_daily: number | null;
  active: boolean; duration_minutes?: number; available_slots?: Record<string, string[]>;
};

const SERVICE_ICONS: Record<string, string> = {
  walk: '🦮', daycare: '🏠', boarding: '🌙', training: '🎯', bath: '🛁', vet_visit: '🏥',
};

export default function WalkerConnectScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);

  const [codes, setCodes]         = useState<InviteCode[]>([]);
  const [links, setLinks]         = useState<LinkedPet[]>([]);
  const [services, setServices]   = useState<WalkerService[]>([]);
  const [showPrices, setShowPrices] = useState(true);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!walkerProfile) return;
    const [codesRes, linksRes, servicesRes, profileRes] = await Promise.all([
      supabase
        .from('walker_invite_codes')
        .select('id, code, expires_at, used_count, max_uses, created_at')
        .eq('walker_id', walkerProfile.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('walker_pet_links')
        .select('id, status, linked_at, pet:pets(id,name,breed,photo_uri), owner:user_profiles(user_id,name,avatar_url)')
        .eq('walker_id', walkerProfile.id)
        .eq('status', 'active')
        .order('linked_at', { ascending: false }),
      supabase
        .from('walker_services')
        .select('id, type, label, price, price_daily, active, duration_minutes, available_slots')
        .eq('walker_id', walkerProfile.id)
        .eq('active', true),
      supabase
        .from('walker_profiles')
        .select('show_prices')
        .eq('id', walkerProfile.id)
        .maybeSingle(),
    ]);
    setCodes((codesRes.data as InviteCode[]) ?? []);
    setLinks((linksRes.data as LinkedPet[]) ?? []);
    setServices((servicesRes.data as WalkerService[]) ?? []);
    setShowPrices(profileRes.data?.show_prices ?? true);
  }, [walkerProfile]);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const generateCode = async () => {
    if (!walkerProfile) return;
    setGenerating(true);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      let attempts = 0;
      while (attempts < 10) {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const { data: existing } = await supabase
          .from('walker_invite_codes').select('id').eq('code', code).maybeSingle();
        if (!existing) break;
        attempts++;
      }
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const { data, error } = await supabase
        .from('walker_invite_codes')
        .insert({ walker_id: walkerProfile.id, code, expires_at: expires.toISOString(), max_uses: 10 })
        .select()
        .single();
      if (error) throw error;
      setCodes((prev) => [data as InviteCode, ...prev]);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível gerar o código.');
    } finally {
      setGenerating(false);
    }
  };

  const shareCode = async (code: string) => {
    await Share.share({
      message: `Use o código **${code}** no app Zupet para vincular seus pets a mim como walker! 🐾`,
      title: 'Código de convite Zupet',
    });
  };

  const revokeCode = async (id: string) => {
    Alert.alert('Revogar código', 'Este código deixará de funcionar. Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revogar', style: 'destructive',
        onPress: async () => {
          await supabase.from('walker_invite_codes').delete().eq('id', id);
          setCodes((prev) => prev.filter((c) => c.id !== id));
        },
      },
    ]);
  };

  const isExpired = (code: InviteCode) =>
    new Date(code.expires_at) < new Date() || code.used_count >= code.max_uses;

  const activeCodes  = codes.filter((c) => !isExpired(c));
  const expiredCodes = codes.filter((c) => isExpired(c));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Perfil Público</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Preview do perfil público */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>COMO OS TUTORES TE VEEM</Text>
              <View style={styles.profileCard}>
                <View style={styles.profileAvatarRow}>
                  {walkerProfile?.avatar_url ? (
                    <Image source={{ uri: walkerProfile.avatar_url }} style={styles.profileAvatar} />
                  ) : (
                    <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
                      <Ionicons name="person" size={32} color={Colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{walkerProfile?.name ?? '—'}</Text>
                    {walkerProfile?.city ? (
                      <View style={styles.profileLocation}>
                        <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                        <Text style={styles.profileLocationText}>
                          {walkerProfile.city}{(walkerProfile as any)?.state ? `, ${(walkerProfile as any).state}` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {walkerProfile?.rating ? (
                      <View style={styles.profileRating}>
                        <Ionicons name="star" size={13} color="#F59E0B" />
                        <Text style={styles.profileRatingText}>{walkerProfile.rating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {walkerProfile?.bio ? (
                  <Text style={styles.profileBio} numberOfLines={3}>{walkerProfile.bio}</Text>
                ) : (
                  <Text style={styles.profileBioEmpty}>Sem bio ainda. Adicione uma na edição de perfil.</Text>
                )}

                {/* Diferenciais do serviço */}
                {(walkerProfile as any)?.summary_items?.length > 0 && (
                  <View style={{ marginTop: 12, gap: 6 }}>
                    {((walkerProfile as any).summary_items as string[]).map((item: string, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <Text style={{ color: Colors.primary, fontSize: 14, lineHeight: 20 }}>✓</Text>
                        <Text style={{ flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Redes sociais */}
                {(() => {
                  const social = (walkerProfile as any)?.social_links as SocialLinks | null;
                  const active = SOCIAL_CONFIG.filter((s) => social?.[s.key]);
                  if (!active.length) return null;
                  return (
                    <View style={styles.socialRow}>
                      {active.map(({ key, icon, color, prefix, isPhone }) => {
                        const raw = (social![key] as string).replace(/^@/, '');
                        const handle = isPhone ? raw.replace(/\D/g, '') : raw;
                        const displayLabel = isPhone ? handle : `@${handle}`;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[styles.socialBtn, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}
                            onPress={() => Linking.openURL(`${prefix}${handle}`)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={icon as any} size={16} color={color} />
                            <Text style={[styles.socialHandle, { color }]}>{displayLabel}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}

                {services.length > 0 && (
                  <View style={styles.serviceList}>
                    <Text style={styles.serviceListLabel}>SERVIÇOS DISPONÍVEIS</Text>
                    {services.map((s) => {
                      const slotCount = s.available_slots
                        ? Object.values(s.available_slots).reduce((acc, arr) => acc + arr.length, 0)
                        : 0;
                      const isDaily = ['hotel', 'day_care', 'boarding', 'daycare'].includes(s.type);
                      const displayPrice = isDaily && s.price_daily != null && Number(s.price_daily) > 0
                        ? s.price_daily : s.price;
                      const priceLabel = `${formatPrice(displayPrice)}${isDaily ? '/dia' : ''}`;
                      return (
                        <View key={s.id} style={styles.serviceRow}>
                          <Text style={styles.serviceRowIcon}>{SERVICE_ICONS[s.type] ?? '🐾'}</Text>
                          <View style={styles.serviceRowBody}>
                            <Text style={styles.serviceRowName}>{s.label}</Text>
                            {slotCount > 0 && (
                              <Text style={styles.serviceRowMeta}>
                                {slotCount} horário{slotCount !== 1 ? 's' : ''} disponíveis
                              </Text>
                            )}
                          </View>
                          {showPrices && (
                            <Text style={styles.serviceRowPrice}>{priceLabel}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* Códigos de convite */}
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>CÓDIGOS DE CONVITE</Text>
                <TouchableOpacity
                  style={[styles.generateBtn, generating && { opacity: 0.6 }]}
                  onPress={generateCode}
                  disabled={generating}
                  activeOpacity={0.8}
                >
                  {generating
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Ionicons name="add" size={16} color="#fff" />
                        <Text style={styles.generateBtnText}>Gerar código</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSub}>
                Compartilhe um código com o tutor para que ele vincule os pets a você.
              </Text>

              {activeCodes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="ticket-outline" size={28} color={Colors.border} />
                  <Text style={styles.emptyText}>Nenhum código ativo. Gere um acima.</Text>
                </View>
              ) : (
                <View style={styles.codeList}>
                  {activeCodes.map((c) => {
                    const daysLeft = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000);
                    return (
                      <View key={c.id} style={styles.codeCard}>
                        <View style={styles.codeMain}>
                          <Text style={styles.codeText}>{c.code}</Text>
                          <View style={styles.codeMeta}>
                            <Text style={styles.codeUses}>{c.used_count}/{c.max_uses} usos</Text>
                            <Text style={styles.codeExpiry}>expira em {daysLeft}d</Text>
                          </View>
                        </View>
                        <View style={styles.codeActions}>
                          <TouchableOpacity style={styles.codeShareBtn} onPress={() => shareCode(c.code)} activeOpacity={0.8}>
                            <Ionicons name="share-outline" size={18} color={Colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.codeRevokeBtn} onPress={() => revokeCode(c.id)} activeOpacity={0.8}>
                            <Ionicons name="trash-outline" size={16} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {expiredCodes.length > 0 && (
                <View style={styles.expiredSection}>
                  <Text style={styles.expiredLabel}>EXPIRADOS / ESGOTADOS</Text>
                  {expiredCodes.slice(0, 3).map((c) => (
                    <View key={c.id} style={[styles.codeCard, styles.codeCardExpired]}>
                      <View style={styles.codeMain}>
                        <Text style={[styles.codeText, styles.codeTextExpired]}>{c.code}</Text>
                        <Text style={styles.codeUses}>{c.used_count}/{c.max_uses} usos</Text>
                      </View>
                      <TouchableOpacity style={styles.codeRevokeBtn} onPress={() => revokeCode(c.id)} activeOpacity={0.8}>
                        <Ionicons name="trash-outline" size={16} color={Colors.border} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Pets vinculados */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PETS VINCULADOS ({links.length})</Text>
              {links.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="paw-outline" size={28} color={Colors.border} />
                  <Text style={styles.emptyText}>Nenhum pet vinculado ainda.</Text>
                </View>
              ) : (
                <View style={styles.linkList}>
                  {links.map((link) => (
                    <View key={link.id} style={styles.linkRow}>
                      <View style={styles.linkPetIcon}>
                        <Ionicons name="paw" size={16} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linkPetName}>{link.pet?.name ?? '—'}</Text>
                        <Text style={styles.linkOwnerName}>
                          Tutor: {link.owner?.name ?? '—'} · {link.pet?.breed ?? 'Raça não informada'}
                        </Text>
                      </View>
                      <View style={styles.linkStatusChip}>
                        <Text style={styles.linkStatusText}>Ativo</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
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
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },

  scroll: { paddingBottom: 48, gap: 24 },

  section: { paddingHorizontal: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  sectionSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12, marginTop: -4 },

  // Perfil público
  profileCard: {
    backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12,
  },
  profileAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32 },
  profileAvatarPlaceholder: {
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 2, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  profileName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  profileLocation: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  profileLocationText: { fontSize: 12, color: Colors.textSecondary },
  profileRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  profileRatingText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  profileBio: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  profileBioEmpty: { fontSize: 13, color: Colors.border, fontStyle: 'italic' },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  socialHandle: { fontSize: 12, fontWeight: '600' },

  serviceList: { gap: 8, marginTop: 4 },
  serviceListLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 2 },
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  serviceRowIcon: { fontSize: 20 },
  serviceRowBody: { flex: 1, gap: 2 },
  serviceRowName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  serviceRowMeta: { fontSize: 11, color: Colors.textSecondary },
  serviceRowPrice: { fontSize: 15, fontWeight: '800', color: Colors.primary },

  // Codes
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  generateBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  codeList: { gap: 10 },
  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  codeCardExpired: { opacity: 0.55 },
  codeMain: { gap: 3 },
  codeText: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: 4 },
  codeTextExpired: { color: Colors.textSecondary },
  codeMeta: { flexDirection: 'row', gap: 10 },
  codeUses: { fontSize: 12, color: Colors.textSecondary },
  codeExpiry: { fontSize: 12, color: Colors.warning },
  codeActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeShareBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  codeRevokeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.error}10`,
    justifyContent: 'center', alignItems: 'center',
  },

  expiredSection: { marginTop: 16, gap: 8 },
  expiredLabel: { fontSize: 10, fontWeight: '700', color: Colors.border, letterSpacing: 0.8 },

  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 24, alignItems: 'center', gap: 8,
  },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  // Links
  linkList: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  linkPetIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.primary}15`, justifyContent: 'center', alignItems: 'center',
  },
  linkPetName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  linkOwnerName: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  linkStatusChip: {
    backgroundColor: `${Colors.success}15`, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  linkStatusText: { fontSize: 11, fontWeight: '600', color: Colors.success },
});
