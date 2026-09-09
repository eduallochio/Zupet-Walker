import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useWalkStore } from '../../stores/walkStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import type { WalkSession } from '../../types/walker';
import { sendPushToOwner } from '../../services/ownerPushService';

type SaveState = 'saving' | 'saved' | 'error';

export default function WalkSummaryScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const activeWalk    = useWalkStore((s) => s.activeWalk);
  const endWalk       = useWalkStore((s) => s.endWalk);

  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [session, setSession]     = useState<WalkSession | null>(null);

  useEffect(() => {
    if (!activeWalk || !walkerProfile) {
      setSaveState('error');
      return;
    }

    const endedAt = new Date().toISOString();
    const startedMs = new Date(activeWalk.started_at).getTime();
    const durationMinutes = Math.round((Date.now() - startedMs) / 60000);

    const sessionData = {
      walker_id:        walkerProfile.id,
      schedule_id:      activeWalk.schedule_id ?? null,
      started_at:       activeWalk.started_at,
      ended_at:         endedAt,
      duration_minutes: durationMinutes,
      distance_meters:  Math.round(activeWalk.distance_meters),
      notes:            activeWalk.notes ?? null,
      photos:           activeWalk.photos ?? [],
      pet_ids:          activeWalk.pet_ids,
    };

    supabase
      .from('walk_sessions')
      .insert(sessionData)
      .select('*')
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          console.error('Erro ao salvar sessão:', error);
          setSaveState('error');
          return;
        }

        // Salvar eventos separadamente
        if (activeWalk.events.length > 0) {
          const events = activeWalk.events.map((e) => ({
            ...e,
            session_id: data.id,
          }));
          supabase.from('walk_events').insert(events).then(() => {});
        }

        // Buscar preço do serviço cadastrado pelo walker
        const serviceType = activeWalk.service_type ?? 'walk';
        const { data: serviceData } = await supabase
          .from('walker_services')
          .select('price, billing_type')
          .eq('walker_id', walkerProfile.id)
          .eq('type', serviceType)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        const servicePrice   = serviceData?.price ?? 0;
        const serviceBilling = serviceData?.billing_type ?? 'per_session';

        // Enviar relatório ao(s) tutor(es) dos pets e registrar ganho por tutor
        if (activeWalk.pet_ids.length > 0) {
          const { data: links } = await supabase
            .from('walker_pet_links')
            .select('owner_id, pet_id')
            .in('pet_id', activeWalk.pet_ids)
            .eq('walker_id', walkerProfile.id);

          // Mapear owner_id → pet_ids desse tutor
          const ownerPetMap: Record<string, string[]> = {};
          for (const link of (links ?? []) as { owner_id: string; pet_id: string }[]) {
            if (!ownerPetMap[link.owner_id]) ownerPetMap[link.owner_id] = [];
            ownerPetMap[link.owner_id].push(link.pet_id);
          }
          const ownerIds = Object.keys(ownerPetMap);

          for (const owner_id of ownerIds) {
            const ownerPetIds = ownerPetMap[owner_id];
            const ownerEvents = activeWalk.events.filter(
              (e) => !e.pet_id || ownerPetIds.includes(e.pet_id)
            );
            const peeCount  = ownerEvents.filter((e) => e.type === 'pee').length;
            const poopCount = ownerEvents.filter((e) => e.type === 'poop').length;
            const noteCount = ownerEvents.filter((e) => e.type === 'note').length;

            const { data: reportData } = await supabase.from('walk_reports').insert({
              session_id:       data.id,
              walker_id:        walkerProfile.id,
              owner_id,
              pet_ids:          ownerPetIds,
              duration_minutes: durationMinutes,
              distance_meters:  Math.round(activeWalk.distance_meters),
              pee_count:        peeCount,
              poop_count:       poopCount,
              note_count:       noteCount,
              photos:           activeWalk.photos ?? [],
              notes:            activeWalk.notes ?? null,
            }).select('id').single();

            // Notificar o tutor que o passeio foi concluído
            const notifTitle = 'Passeio concluído! 🐾';
            const notifBody  = `${walkerProfile.name ?? 'Seu walker'} finalizou o passeio: ${durationMinutes} min · ${(Math.round(activeWalk.distance_meters) / 1000).toFixed(1)} km`;
            await supabase.from('notifications').insert({
              user_id: owner_id,
              type:    'walk_report',
              title:   notifTitle,
              body:    notifBody,
              data:    { report_id: reportData?.id, session_id: data.id },
            });
            sendPushToOwner(owner_id, notifTitle, notifBody, { report_id: reportData?.id, session_id: data.id });

            // Registrar ganho deste tutor em walker_payments
            await supabase.from('walker_payments').insert({
              walker_id:       walkerProfile.id,
              owner_id,
              walk_session_id: data.id,
              session_id:      data.id,
              service_type:    serviceType,
              amount:          servicePrice,
              billing_type:    serviceBilling,
              status:          'pending',
              pet_ids:         ownerPetIds,
            });
          }

          // Pets próprios (sem tutor vinculado): registrar ganho no próprio walker
          if (ownerIds.length === 0) {
            await supabase.from('walker_payments').insert({
              walker_id:       walkerProfile.id,
              owner_id:        walkerProfile.user_id,
              walk_session_id: data.id,
              session_id:      data.id,
              service_type:    serviceType,
              amount:          servicePrice,
              billing_type:    serviceBilling,
              status:          'pending',
              pet_ids:         activeWalk.pet_ids,
            });
          }
        }

        setSession({ ...data, events: activeWalk.events } as WalkSession);
        setSaveState('saved');
        endWalk(); // limpa o store
      });
  }, []);

  const durationMinutes = activeWalk
    ? Math.round((Date.now() - new Date(activeWalk.started_at).getTime()) / 60000)
    : session?.duration_minutes ?? 0;

  const eventsByType = activeWalk?.events ?? session?.events ?? [];
  const peeCount  = eventsByType.filter((e) => e.type === 'pee').length;
  const poopCount = eventsByType.filter((e) => e.type === 'poop').length;
  const noteCount = eventsByType.filter((e) => e.type === 'note').length;
  const petCount  = (activeWalk?.pet_ids ?? session?.pet_ids ?? []).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Ícone de status */}
        <View style={styles.iconWrap}>
          {saveState === 'saving' ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : saveState === 'saved' ? (
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={44} color="#fff" />
            </View>
          ) : (
            <View style={[styles.successCircle, { backgroundColor: Colors.warning }]}>
              <Ionicons name="warning" size={44} color="#fff" />
            </View>
          )}
        </View>

        <Text style={styles.title}>
          {saveState === 'saving' ? 'Salvando passeio...' :
           saveState === 'saved'  ? 'Passeio finalizado!' : 'Salvo localmente'}
        </Text>
        <Text style={styles.subtitle}>
          {saveState === 'saving' ? 'Aguarde um momento' :
           saveState === 'saved'  ? 'Ótimo trabalho! O resumo está abaixo.' :
           'Não foi possível sincronizar agora. Os dados serão salvos depois.'}
        </Text>

        {/* Stats do passeio */}
        {saveState !== 'saving' && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>RESUMO DO PASSEIO</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{durationMinutes}</Text>
                <Text style={styles.statLabel}>minutos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{petCount}</Text>
                <Text style={styles.statLabel}>pet{petCount !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{eventsByType.length}</Text>
                <Text style={styles.statLabel}>eventos</Text>
              </View>
            </View>

            {(peeCount + poopCount + noteCount) > 0 && (
              <View style={styles.eventSummary}>
                {peeCount > 0 && (
                  <View style={styles.eventRow}>
                    <Text style={styles.eventEmoji}>💧</Text>
                    <Text style={styles.eventRowText}>{peeCount} xixi{peeCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
                {poopCount > 0 && (
                  <View style={styles.eventRow}>
                    <Text style={styles.eventEmoji}>💩</Text>
                    <Text style={styles.eventRowText}>{poopCount} cocô{poopCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
                {noteCount > 0 && (
                  <View style={styles.eventRow}>
                    <Text style={styles.eventEmoji}>📝</Text>
                    <Text style={styles.eventRowText}>{noteCount} nota{noteCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {saveState !== 'saving' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
            <Ionicons name="home-outline" size={18} color="#fff" />
            <Text style={styles.homeBtnText}>Voltar ao início</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, alignItems: 'center', gap: 16, paddingBottom: 8 },

  iconWrap: { marginTop: 32, marginBottom: 8 },
  successCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center',
  },

  title: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  statsCard: {
    width: '100%', backgroundColor: Colors.card,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    padding: 20, gap: 16,
  },
  statsTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 32, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  eventSummary: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14, gap: 8,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventEmoji: { fontSize: 18 },
  eventRowText: { fontSize: 14, color: Colors.text, fontWeight: '600' },

  footer: { padding: 20, paddingTop: 12 },
  homeBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  homeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
