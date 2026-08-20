import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useWalkStore } from '../../stores/walkStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { startLocationTracking, stopLocationTracking } from '../../services/locationService';
import type { WalkEventType } from '../../types/walker';

type PetInfo = { id: string; name: string; breed?: string };

type EventBtn = { icon: string; label: string; type: WalkEventType };
const EVENT_BUTTONS: EventBtn[] = [
  { icon: '💧', label: 'Xixi',      type: 'pee'         },
  { icon: '💩', label: 'Cocô',      type: 'poop'        },
  { icon: '🐾', label: 'Interação', type: 'interaction' },
  { icon: '😊', label: 'Humor',     type: 'mood'        },
  { icon: '📝', label: 'Nota',      type: 'note'        },
];

function formatElapsed(startIso: string) {
  const s = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

export default function ActiveWalkScreen() {
  const router = useRouter();
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const activeWalk    = useWalkStore((s) => s.activeWalk);
  const endWalk       = useWalkStore((s) => s.endWalk);
  const addEvent      = useWalkStore((s) => s.addEvent);
  const addPhoto      = useWalkStore((s) => s.addPhoto);
  const setNotes      = useWalkStore((s) => s.setNotes);

  const [, setTick]   = useState(0);
  const [pets, setPets] = useState<PetInfo[]>([]);
  const [noteModal, setNoteModal] = useState<{ petId: string } | null>(null);
  const [noteText, setNoteText]   = useState('');
  const [walkNoteModal, setWalkNoteModal] = useState(false);
  const [walkNoteText, setWalkNoteText]   = useState('');

  // Se não tem passeio ativo, redireciona para seleção
  useEffect(() => {
    if (!activeWalk) {
      router.replace('/walk/start');
      return;
    }
    // Inicia GPS ao entrar na tela
    startLocationTracking().catch(console.error);
    return () => { stopLocationTracking().catch(console.error); };
  }, []);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Buscar nomes dos pets
  useEffect(() => {
    if (!activeWalk || activeWalk.pet_ids.length === 0) return;
    supabase
      .from('pets')
      .select('id, name, breed')
      .in('id', activeWalk.pet_ids)
      .then(({ data }) => setPets((data as PetInfo[]) ?? []));
  }, [activeWalk?.pet_ids.join(',')]);

  const getPetName = (id: string) => pets.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const eventCountForPet = useCallback((petId: string, type: WalkEventType) =>
    activeWalk?.events.filter((e) => e.pet_id === petId && e.type === type).length ?? 0,
  [activeWalk?.events]);

  const handleEventBtn = (petId: string, type: WalkEventType) => {
    if (type === 'note') {
      setNoteText('');
      setNoteModal({ petId });
      return;
    }
    addEvent(petId, type);
  };

  const handleSaveNote = () => {
    if (!noteModal || !noteText.trim()) { setNoteModal(null); return; }
    addEvent(noteModal.petId, 'note', noteText.trim());
    setNoteModal(null);
    setNoteText('');
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Permita acesso à câmera nas configurações.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('walk-photos')
        .upload(path, blob, { contentType: `image/${ext}`, upsert: false });

      if (error) throw error;

      const { data: signedData } = await supabase.storage
        .from('walk-photos')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 ano

      addPhoto(signedData?.signedUrl ?? uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a foto. Tente novamente.');
    }
  };

  const handleFinish = () =>
    Alert.alert('Finalizar passeio', 'Deseja encerrar o passeio agora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar',
        onPress: () => {
          router.replace('/walk/summary');
        },
      },
    ]);

  if (!activeWalk) return null;

  const totalEvents = activeWalk.events.length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Timer header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>AO VIVO</Text>
        </View>
        <Text style={styles.timer}>{formatElapsed(activeWalk.started_at)}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.walkNoteBtn, activeWalk.notes ? styles.walkNoteBtnActive : null]}
            onPress={() => { setWalkNoteText(activeWalk.notes ?? ''); setWalkNoteModal(true); }}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={16} color="#fff" />
          </TouchableOpacity>
          <Ionicons name="paw" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.petsCount}>{activeWalk.pet_ids.length} pets</Text>
        </View>
      </View>

      {/* Stats rápidas */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalEvents}</Text>
          <Text style={styles.statLabel}>Eventos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {activeWalk.distance_meters != null && activeWalk.distance_meters >= 1000
              ? `${(activeWalk.distance_meters / 1000).toFixed(1)}km`
              : `${Math.round(activeWalk.distance_meters ?? 0)}m`}
          </Text>
          <Text style={styles.statLabel}>📍 Distância</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {activeWalk.events.filter((e) => e.type === 'pee').length}💧
            {' '}{activeWalk.events.filter((e) => e.type === 'poop').length}💩
          </Text>
          <Text style={styles.statLabel}>Registros</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {activeWalk.pet_ids.map((petId) => (
          <View key={petId} style={styles.petSection}>
            <View style={styles.petHeader}>
              <View style={styles.petAvatar}>
                <Ionicons name="paw" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.petName}>{getPetName(petId)}</Text>
              <Text style={styles.petEventCount}>
                {activeWalk.events.filter((e) => e.pet_id === petId).length} eventos
              </Text>
            </View>

            <View style={styles.eventGrid}>
              {EVENT_BUTTONS.map((btn) => {
                const count = eventCountForPet(petId, btn.type);
                return (
                  <TouchableOpacity
                    key={btn.type}
                    style={styles.eventBtn}
                    onPress={() => handleEventBtn(petId, btn.type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eventIcon}>{btn.icon}</Text>
                    <Text style={styles.eventLabel}>{btn.label}</Text>
                    {count > 0 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Barra de ações */}
      <View style={styles.actionBar}>
        {/* Botão câmera — oculto até o banco suportar fotos */}
        <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
          <Ionicons name="camera-outline" size={20} color={Colors.primary} />
          {(activeWalk.photos?.length ?? 0) > 0 && (
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>{activeWalk.photos!.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
          <Ionicons name="stop-circle-outline" size={20} color="#fff" />
          <Text style={styles.finishText}>Finalizar passeio</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de nota geral do passeio */}
      <Modal visible={walkNoteModal} transparent animationType="slide" onRequestClose={() => setWalkNoteModal(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nota geral do passeio</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Observações gerais sobre o passeio..."
              placeholderTextColor={Colors.textSecondary}
              value={walkNoteText}
              onChangeText={setWalkNoteText}
              multiline
              autoFocus
              maxLength={500}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setWalkNoteModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  setNotes(walkNoteText.trim());
                  setWalkNoteModal(false);
                }}
              >
                <Text style={styles.modalSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de nota por pet */}
      <Modal visible={!!noteModal} transparent animationType="slide" onRequestClose={() => setNoteModal(null)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Adicionar nota — {noteModal ? getPetName(noteModal.petId) : ''}
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Escreva uma observação..."
              placeholderTextColor={Colors.textSecondary}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              autoFocus
              maxLength={300}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setNoteModal(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveNote}>
                <Text style={styles.modalSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.primary, paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  timer: { fontSize: 40, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  petsCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  walkNoteBtn: {
    padding: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  walkNoteBtnActive: { backgroundColor: 'rgba(255,255,255,0.4)' },

  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 12,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  statDivider: { width: 1, backgroundColor: Colors.border },

  scroll: { padding: 20, gap: 20, paddingBottom: 8 },

  petSection: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  petHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: `${Colors.primary}08`,
  },
  petAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  petName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  petEventCount: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  eventGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 12, gap: 10,
  },
  eventBtn: {
    width: '18%', minWidth: 56,
    flex: 1,
    backgroundColor: Colors.background, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.border,
    position: 'relative',
  },
  eventIcon: { fontSize: 24 },
  eventLabel: { fontSize: 11, fontWeight: '600', color: Colors.text },
  countBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: Colors.primary, borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  countText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  actionBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, paddingTop: 8,
  },
  cameraBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  photoBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  finishBtn: {
    flex: 1,
    backgroundColor: Colors.error, borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  finishText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  noteInput: {
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 14, fontSize: 15, color: Colors.text, minHeight: 100, textAlignVertical: 'top',
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  modalSaveBtn: {
    flex: 1, borderRadius: 12, padding: 14,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
