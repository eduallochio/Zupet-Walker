import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

// ─── Utilitários ────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const WEEKDAYS = ['D','S','T','Q','Q','S','S'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ─── DatePicker ──────────────────────────────────────────────────────────────

type DatePickerProps = {
  value: Date | null;
  onChange: (d: Date) => void;
};

export function DatePickerButton({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(value?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value?.getMonth()     ?? today.getMonth());

  const label = value
    ? value.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Selecionar data';

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay  = firstWeekday(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day, 0, 0, 0);
    onChange(d);
    setOpen(false);
  };

  const isSelected = (day: number) =>
    value?.getFullYear() === viewYear &&
    value?.getMonth()    === viewMonth &&
    value?.getDate()     === day;

  const isPast = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(23, 59, 59);
    return d < today;
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.calendarCard}>
          {/* Navegação mês */}
          <View style={styles.calNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.calNavTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Cabeçalho dias da semana */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          {/* Grade de dias */}
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const past = isPast(day);
              const sel  = isSelected(day);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.cell, styles.dayCell, sel && styles.dayCellSelected, past && styles.dayCellPast]}
                  onPress={() => !past && selectDay(day)}
                  activeOpacity={past ? 1 : 0.7}
                >
                  <Text style={[styles.dayText, sel && styles.dayTextSelected, past && styles.dayTextPast]}>
                    {String(day)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── TimePicker ──────────────────────────────────────────────────────────────

type TimePickerProps = {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
};

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TimePickerButton({ hour, minute, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [selH, setSelH] = useState(hour);
  const [selM, setSelM] = useState(minute);

  const label = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

  const confirm = () => { onChange(selH, selM); setOpen(false); };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => { setSelH(hour); setSelM(minute); setOpen(true); }} activeOpacity={0.8}>
        <Ionicons name="time-outline" size={16} color={Colors.primary} />
        <Text style={styles.triggerText}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.timeCard}>
          <Text style={styles.timeTitle}>Selecionar horário</Text>

          <View style={styles.timeBody}>
            {/* Horas */}
            <View style={styles.timeCol}>
              <Text style={styles.timeColLabel}>Hora</Text>
              <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.timeItem, selH === h && styles.timeItemSelected]}
                    onPress={() => setSelH(h)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timeItemText, selH === h && styles.timeItemTextSelected]}>
                      {String(h).padStart(2,'0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.timeSep}>:</Text>

            {/* Minutos */}
            <View style={styles.timeCol}>
              <Text style={styles.timeColLabel}>Min</Text>
              <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.timeItem, selM === m && styles.timeItemSelected]}
                    onPress={() => setSelM(m)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timeItemText, selM === m && styles.timeItemTextSelected]}>
                      {String(m).padStart(2,'0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={confirm} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  triggerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  triggerPlaceholder: { color: Colors.textSecondary, fontWeight: '400' },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Calendar
  calendarCard: {
    position: 'absolute', alignSelf: 'center',
    top: '20%',
    backgroundColor: Colors.card,
    borderRadius: 20, padding: 20,
    width: 320,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 6 },
  calNavTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCell: {},
  dayCellSelected: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 32, height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellPast: { opacity: 0.3 },
  dayText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dayTextSelected: { color: '#fff' },
  dayTextPast: { color: Colors.textSecondary },

  // Time
  timeCard: {
    position: 'absolute', alignSelf: 'center',
    top: '25%',
    backgroundColor: Colors.card,
    borderRadius: 20, padding: 20,
    width: 260,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  timeTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 16 },
  timeBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeCol: { flex: 1, alignItems: 'center' },
  timeColLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  timeScroll: { height: 180 },
  timeItem: {
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, marginVertical: 2, alignItems: 'center',
  },
  timeItemSelected: { backgroundColor: Colors.primary },
  timeItemText: { fontSize: 18, fontWeight: '700', color: Colors.text },
  timeItemTextSelected: { color: '#fff' },
  timeSep: { fontSize: 24, fontWeight: '800', color: Colors.text, marginTop: 20 },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 16,
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
