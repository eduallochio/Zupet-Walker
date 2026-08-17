import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import SlotBlocker from '../components/availability/SlotBlocker';

export default function AvailabilityScreen() {
  const router = useRouter();
  const { service_id } = useLocalSearchParams<{ service_id: string }>();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serviceLabel, setServiceLabel] = useState('');
  const [availableSlots, setAvailableSlots] = useState<Record<string, string[]>>({});
  const [blockedSlots, setBlockedSlots] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!service_id) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('walker_services')
        .select('label, available_slots, blocked_slots')
        .eq('id', service_id)
        .maybeSingle();
      if (data) {
        setServiceLabel(data.label ?? '');
        setAvailableSlots(data.available_slots ?? {});
        setBlockedSlots(data.blocked_slots ?? {});
      }
      setLoading(false);
    })();
  }, [service_id]);

  const save = async () => {
    if (!service_id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('walker_services')
        .update({ blocked_slots: blockedSlots, updated_at: new Date().toISOString() })
        .eq('id', service_id);
      if (error) throw error;
      Alert.alert('Salvo!', 'Horários bloqueados atualizados.');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bloquear Horários</Text>
          {serviceLabel ? <Text style={styles.subtitle}>{serviceLabel}</Text> : null}
        </View>
        <TouchableOpacity onPress={save} style={styles.saveBtn} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Text style={styles.saveText}>Salvar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SlotBlocker
          availableSlots={availableSlots}
          blockedSlots={blockedSlots}
          onChange={setBlockedSlots}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  headerBtn: { padding: 4 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  saveBtn: { minWidth: 52, alignItems: 'flex-end' },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  scroll: { padding: 20, paddingBottom: 48 },
});
