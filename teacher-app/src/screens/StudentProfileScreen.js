import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, StatusBar, RefreshControl, Alert,
  Modal, TextInput, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE } from '../config';



const ACTIVITY_COLORS = {
  Gatha:     { bg: '#f59e0b22', border: '#f59e0b', text: '#f59e0b', icon: '🙏' },
  Aaradhana: { bg: '#a78bfa22', border: '#a78bfa', text: '#a78bfa', icon: '✨' },
  Conduct:   { bg: '#ef444422', border: '#ef4444', text: '#ef4444', icon: '⚠️' },
};

const ATTEND_COLORS = {
  Present: { bg: '#22c55e22', border: '#22c55e', text: '#22c55e', icon: '✅' },
  Late:    { bg: '#f59e0b22', border: '#f59e0b', text: '#f59e0b', icon: '🕐' },
  Absent:  { bg: '#ef444422', border: '#ef4444', text: '#ef4444', icon: '❌' },
};

function todayString() {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StudentProfileScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const [student,    setStudent]    = useState(initialStudent);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState('Attendance'); // 'Attendance' | 'Activity'
  const [teacherName, setTeacherName] = useState('Unknown Teacher');
  
  // Dynamic Settings states (initialized with standard defaults)
  const [gathaList, setGathaList] = useState([
    { name: 'Navkar Mantra', pts: 10 },
    { name: 'Logassa Sutra', pts: 20 },
    { name: 'Uvasaggaharam Stotra', pts: 20 },
    { name: 'Bhaktamar Stotra', pts: 50 },
    { name: 'Namutthunam Sutra', pts: 15 },
    { name: 'Aarti', pts: 10 }
  ]);

  useEffect(() => {
    const loadTeacherDataAndSettings = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setTeacherName(userData.name || 'Unknown Teacher');
        }

        // Fetch settings dynamically from the live database
        const settingsRes = await fetch(`${API_BASE}/settings`);
        const settingsJson = await settingsRes.json();
        if (settingsJson.success && settingsJson.data && settingsJson.data.gathaList && settingsJson.data.gathaList.length > 0) {
          setGathaList(settingsJson.data.gathaList);
        }
      } catch (err) {
        console.error('AsyncStorage or settings read error:', err);
      }
    };
    loadTeacherDataAndSettings();
  }, []);

  // Log Activity modal
  const [logModal,      setLogModal]      = useState(false);
  const [logType,       setLogType]       = useState('Gatha');
  const [selectedGathas,setSelectedGathas]= useState({});
  const [customDesc,    setCustomDesc]    = useState('');
  const [customPts,     setCustomPts]     = useState('');
  const [submitting,    setSubmitting]    = useState(false);

  // ── Fetch fresh student data ──────────────────────────────────────────────
  const fetchStudent = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/students/${initialStudent._id}`);
      const json = await res.json();
      if (json.success) setStudent(json.data);
    } catch {
      Alert.alert('Error', 'Could not refresh student data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialStudent._id]);

  useEffect(() => { fetchStudent(); }, [fetchStudent]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const attendanceLogs = [...(student?.attendanceLogs || [])].sort((a, b) => b.date.localeCompare(a.date));
  const activityLogs   = [...(student?.activityLogs   || [])].sort((a, b) => b.date.localeCompare(a.date));
  const totalLogs      = attendanceLogs.length;
  const presentLogs    = attendanceLogs.filter(l => l.status === 'Present' || l.status === 'Late').length;
  const attendancePct  = totalLogs > 0 ? Math.round((presentLogs / totalLogs) * 100) : 0;
  const nameParts      = (student?.name || '').trim().split(/\s+/);
  const initials       = (nameParts[0]?.[0] ?? '') + (nameParts[1]?.[0] ?? '');

  // ── Submit activity log ───────────────────────────────────────────────────
  const submitActivity = async () => {
    const items = [];

    if (logType === 'Gatha') {
      gathaList.filter(g => selectedGathas[g.name]).forEach(g =>
        items.push({ type: 'Gatha', description: g.name, pointsAwarded: g.pts })
      );
      if (customDesc.trim() && Number(customPts) !== 0) {
        items.push({ type: 'Gatha', description: customDesc.trim(), pointsAwarded: Number(customPts) });
      }
    } else if (logType === 'Aaradhana') {
      if (!customDesc.trim() || !customPts) { Alert.alert('Fill in description and points.'); return; }
      items.push({ type: 'Aaradhana', description: customDesc.trim(), pointsAwarded: Number(customPts) });
    } else {
      // Conduct deduction
      if (!customDesc.trim() || !customPts) { Alert.alert('Fill in description and points.'); return; }
      items.push({ type: 'Conduct', description: customDesc.trim(), pointsAwarded: -Math.abs(Number(customPts)) });
    }

    if (items.length === 0) { Alert.alert('Select at least one item.'); return; }

    setSubmitting(true);
    try {
      await Promise.all(
        items.map(item =>
          fetch(`${API_BASE}/students/${student._id}/activity`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ...item, date: todayString(), loggedBy: teacherName }),
          })
        )
      );
      setLogModal(false);
      setSelectedGathas({});
      setCustomDesc('');
      setCustomPts('');
      fetchStudent(true);
    } catch {
      Alert.alert('Error', 'Could not save activity log.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0e17" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchStudent(true)} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
          </View>
          <Text style={styles.studentName}>{student.name}</Text>

          <View style={styles.badgeRow}>
            <Badge label={`Roll ${student.rollNo}`} color="#818cf8" />
            {student.village ? <Badge label={student.village} color="#6366f1" /> : null}
          </View>

          {student.phoneNumber ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${student.phoneNumber}`)}>
              <Text style={styles.phone}>📞 {student.phoneNumber}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Points badge */}
          <View style={styles.pointsGlow}>
            <Text style={styles.pointsValue}>⭐  {student.points || 0}</Text>
            <Text style={styles.pointsLabel}>Total Points</Text>
          </View>

          {/* Attendance progress */}
          <Text style={styles.attendLabel}>Attendance: {attendancePct}%  ({presentLogs}/{totalLogs} sessions)</Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${attendancePct}%` }]} />
          </View>
        </View>

        {/* ── Tab Switcher ── */}
        <View style={styles.tabs}>
          {['Attendance', 'Activity'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Attendance Tab ── */}
        {activeTab === 'Attendance' && (
          attendanceLogs.length === 0
            ? <Text style={styles.emptyText}>No attendance records yet.</Text>
            : attendanceLogs.map((log, i) => {
                const cfg = ATTEND_COLORS[log.status] ?? ATTEND_COLORS.Absent;
                return (
                  <View key={i} style={[styles.logRow, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                    <Text style={styles.logIcon}>{cfg.icon}</Text>
                    <View style={styles.logInfo}>
                      <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                      <Text style={[styles.logStatus, { color: cfg.text }]}>
                        {log.status}  {log.pointsAwarded > 0 ? `+${log.pointsAwarded} pts` : ''}
                        {log.loggedBy && <Text style={{ color: '#818cf8', fontStyle: 'italic', fontSize: 11 }}>  by {log.loggedBy}</Text>}
                      </Text>
                    </View>
                  </View>
                );
              })
        )}

        {/* ── Activity Tab ── */}
        {activeTab === 'Activity' && (
          activityLogs.length === 0
            ? <Text style={styles.emptyText}>No activity logged yet.</Text>
            : activityLogs.map((log, i) => {
                const cfg  = ACTIVITY_COLORS[log.type] ?? ACTIVITY_COLORS.Gatha;
                const pts  = log.pointsAwarded;
                return (
                  <View key={i} style={[styles.logRow, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                    <Text style={styles.logIcon}>{cfg.icon}</Text>
                    <View style={styles.logInfo}>
                      <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                      <Text style={styles.logDesc}>{log.description}</Text>
                      {log.loggedBy && <Text style={{ color: '#818cf8', fontStyle: 'italic', fontSize: 11, marginTop: 2 }}>by {log.loggedBy}</Text>}
                    </View>
                    <Text style={{ color: pts >= 0 ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: 13 }}>
                      {pts >= 0 ? `+${pts}` : pts} pts
                    </Text>
                  </View>
                );
              })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Floating Action Button ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setLogType('Gatha');
          setSelectedGathas({});
          setCustomDesc('');
          setCustomPts('');
          setLogModal(true);
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>➕  Log Activity</Text>
      </TouchableOpacity>

      {/* ── Log Activity Modal ── */}
      <Modal visible={logModal} animationType="slide" transparent onRequestClose={() => setLogModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Activity</Text>
            <Text style={styles.modalSub}>{student.name}</Text>

            {/* Type selector */}
            <View style={styles.typeRow}>
              {['Gatha', 'Aaradhana', 'Conduct'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, logType === t && styles.typeBtnActive]}
                  onPress={() => setLogType(t)}
                >
                  <Text style={[styles.typeBtnText, logType === t && styles.typeBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {/* Gatha checklist */}
              {logType === 'Gatha' && gathaList.map(g => {
                const sel = !!selectedGathas[g.name];
                return (
                  <TouchableOpacity
                    key={g.name}
                    style={[styles.gathaRow, sel && styles.gathaRowSel]}
                    onPress={() => setSelectedGathas(p => ({ ...p, [g.name]: !p[g.name] }))}
                  >
                    <Text style={styles.check}>{sel ? '☑' : '☐'}</Text>
                    <Text style={styles.gathaName}>{g.name}</Text>
                    <Text style={styles.gathaPts}>+{g.pts}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Custom / Aaradhana / Conduct fields */}
              <View style={{ gap: 8, paddingTop: 8 }}>
                <TextInput
                  style={styles.input}
                  placeholder={logType === 'Gatha' ? 'Custom Gatha name (optional)…' : 'Description…'}
                  placeholderTextColor="#4c4f6b"
                  value={customDesc}
                  onChangeText={setCustomDesc}
                />
                <TextInput
                  style={styles.input}
                  placeholder={logType === 'Conduct' ? 'Points to deduct…' : 'Points…'}
                  placeholderTextColor="#4c4f6b"
                  keyboardType="numeric"
                  value={customPts}
                  onChangeText={setCustomPts}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
                onPress={submitActivity}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: color, backgroundColor: color + '22' }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0e17' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0e17' },
  loadingText: { marginTop: 12, color: '#a5b4fc', fontSize: 15 },
  scroll:      { padding: 20, paddingBottom: 20 },

  // Profile card
  profileCard:  { backgroundColor: '#1e1b4b', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#312e81' },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: '#312e81', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText:   { color: '#a5b4fc', fontSize: 28, fontWeight: '800' },
  studentName:  { color: '#e0e7ff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  badgeRow:     { flexDirection: 'row', gap: 8, marginBottom: 10 },
  phone:        { color: '#818cf8', fontSize: 14, marginBottom: 14 },
  pointsGlow:   { backgroundColor: '#312e81', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  pointsValue:  { color: '#fbbf24', fontSize: 28, fontWeight: '800' },
  pointsLabel:  { color: '#818cf8', fontSize: 12, marginTop: 2 },
  attendLabel:  { color: '#818cf8', fontSize: 13, marginBottom: 8 },
  progressBg:   { width: '100%', height: 8, backgroundColor: '#312e81', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#22c55e', borderRadius: 4 },

  // Tabs
  tabs:        { flexDirection: 'row', marginBottom: 14, gap: 10 },
  tab:         { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#312e81', alignItems: 'center' },
  tabActive:   { backgroundColor: '#312e81', borderColor: '#6366f1' },
  tabText:     { color: '#4c4f6b', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#e0e7ff' },

  // Log rows
  logRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  logIcon:   { fontSize: 22, marginRight: 12 },
  logInfo:   { flex: 1 },
  logDate:   { color: '#818cf8', fontSize: 11, marginBottom: 2 },
  logStatus: { fontSize: 13, fontWeight: '600' },
  logDesc:   { color: '#e0e7ff', fontSize: 13, fontWeight: '600' },
  emptyText: { color: '#4c4f6b', textAlign: 'center', marginTop: 30 },

  // FAB
  fab: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#6366f1', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalTitle:    { color: '#e0e7ff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  modalSub:      { color: '#818cf8', fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 16 },

  typeRow:       { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeBtn:       { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#312e81', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  typeBtnText:   { color: '#818cf8', fontSize: 12, fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },

  gathaRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#312e81' },
  gathaRowSel: { backgroundColor: '#312e8155', borderRadius: 8 },
  check:       { fontSize: 20, color: '#818cf8', marginRight: 12, width: 24 },
  gathaName:   { flex: 1, color: '#e0e7ff', fontSize: 14 },
  gathaPts:    { color: '#22c55e', fontWeight: '700', fontSize: 13 },

  input: { backgroundColor: '#0f0e17', borderRadius: 8, borderWidth: 1, borderColor: '#312e81', color: '#e0e7ff', padding: 10, fontSize: 14 },

  modalFooter:    { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn:      { flex: 1, backgroundColor: '#312e81', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText:  { color: '#818cf8', fontWeight: '600', fontSize: 14 },
  submitBtn:      { flex: 2, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
