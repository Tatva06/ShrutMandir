import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, StatusBar, RefreshControl, Alert,
  Modal, TextInput, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE } from '../config';
import LegalFooter from '../components/LegalFooter';

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

// IST = UTC+5:30 — use arithmetic so it works in ALL browsers/environments
function todayString() {
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().split('T')[0]; // always 'YYYY-MM-DD'
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
  const [userToken,   setUserToken]   = useState('');
  
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
        const token = await AsyncStorage.getItem('userToken');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setTeacherName(userData.name || 'Unknown Teacher');
        }
        if (token) setUserToken(token);

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
      const token = await AsyncStorage.getItem('userToken');
      await Promise.all(
        items.map(item =>
          fetch(`${API_BASE}/students/${student._id}/activity`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
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
        <ActivityIndicator size="large" color="#8682ff" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0d15" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchStudent(true)} tintColor="#8682ff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
          </View>
          <Text style={styles.studentName}>{student.name}</Text>

          <View style={styles.badgeRow}>
            <Badge label={`Roll ${student.rollNo}`} color="#c3c0ff" />
            {student.village ? <Badge label={student.village} color="#8682ff" /> : null}
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
                        {log.loggedBy && <Text style={{ color: '#c3c0ff', fontStyle: 'italic', fontSize: 11 }}>  by {log.loggedBy}</Text>}
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
                      {log.loggedBy && <Text style={{ color: '#c3c0ff', fontStyle: 'italic', fontSize: 11, marginTop: 2 }}>by {log.loggedBy}</Text>}
                    </View>
                    <Text style={{ color: pts >= 0 ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: 13 }}>
                      {pts >= 0 ? `+${pts}` : pts} pts
                    </Text>
                  </View>
                );
              })
        )}

        <LegalFooter />
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
                  placeholderTextColor="#918fa0"
                  value={customDesc}
                  onChangeText={setCustomDesc}
                />
                <TextInput
                  style={styles.input}
                  placeholder={logType === 'Conduct' ? 'Points to deduct…' : 'Points…'}
                  placeholderTextColor="#918fa0"
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
    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: color, backgroundColor: color + '22' }}>
      <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0d15' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d15' },
  loadingText: { marginTop: 12, color: '#918fa0', fontSize: 15 },
  scroll:      { padding: 20, paddingBottom: 20 },

  // Profile card
  profileCard:  { backgroundColor: 'rgba(44,38,77,0.4)', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  avatar:       { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(44,38,77,0.8)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(134,130,255,0.3)', shadowColor: '#8682ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 5 },
  avatarText:   { color: '#c3c0ff', fontSize: 32, fontWeight: '800' },
  studentName:  { color: '#e6e0ec', fontSize: 28, fontWeight: '800', marginBottom: 12, letterSpacing: -0.5 },
  badgeRow:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  phone:        { color: '#8682ff', fontSize: 15, marginBottom: 16, fontWeight: '600' },
  pointsGlow:   { backgroundColor: 'rgba(44,38,77,0.8)', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  pointsValue:  { color: '#fbbf24', fontSize: 36, fontWeight: '800' },
  pointsLabel:  { color: '#c7c4d6', fontSize: 12, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  attendLabel:  { color: '#918fa0', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  progressBg:   { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#8682ff', borderRadius: 4 },

  // Tabs
  tabs:        { flexDirection: 'row', marginBottom: 16, gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tab:         { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  tabActive:   { backgroundColor: '#8682ff' },
  tabText:     { color: '#918fa0', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },

  // Logs
  emptyText:   { color: '#918fa0', textAlign: 'center', marginTop: 40, fontSize: 15 },
  logRow:      { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  logIcon:     { fontSize: 24, marginRight: 16 },
  logInfo:     { flex: 1 },
  logDate:     { color: '#918fa0', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  logStatus:   { fontSize: 16, fontWeight: '700' },
  logDesc:     { color: '#e6e0ec', fontSize: 15, fontWeight: '600' },

  // FAB
  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: '#8682ff', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 16, shadowColor: '#8682ff', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 25, elevation: 10 },
  fabText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: '#1d1a23', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '85%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle:   { color: '#e6e0ec', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  modalSub:     { color: '#918fa0', fontSize: 14, marginBottom: 20 },
  typeRow:      { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn:      { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  typeBtnActive: { backgroundColor: 'rgba(134,130,255,0.15)', borderColor: '#8682ff' },
  typeBtnText:  { color: '#918fa0', fontSize: 13, fontWeight: '700' },
  typeBtnTextActive: { color: '#c3c0ff' },

  gathaRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  gathaRowSel:  { backgroundColor: 'rgba(134,130,255,0.05)' },
  check:        { color: '#8682ff', fontSize: 20, marginRight: 12 },
  gathaName:    { flex: 1, color: '#e6e0ec', fontSize: 15, fontWeight: '500' },
  gathaPts:     { color: '#4ADE80', fontWeight: '700', fontSize: 14 },

  input:        { backgroundColor: 'rgba(0,0,0,0.3)', color: '#e6e0ec', borderRadius: 12, padding: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  modalFooter:  { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn:    { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  cancelBtnText:{ color: '#918fa0', fontWeight: '700', fontSize: 15 },
  submitBtn:    { flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: '#8682ff', alignItems: 'center', shadowColor: '#8682ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  submitBtnText:{ color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
