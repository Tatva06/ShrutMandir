import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar,
  ActivityIndicator, Modal, ScrollView, TextInput, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE } from '../config';

const SCAN_COOLDOWN_MS = 1200;

const MODES = ['Attendance', 'Gatha', 'General'];

// IST = UTC+5:30 — use arithmetic so it works in ALL browsers/environments
function todayString() {
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().split('T')[0]; // always 'YYYY-MM-DD'
}

export default function ScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('Attendance');
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cooldownRef = useRef(null);
  const [teacherName, setTeacherName] = useState('Unknown Teacher');
  const [userToken, setUserToken] = useState(null);
  
  // Dynamic Settings states (initialized with standard defaults)
  const [gathaList, setGathaList] = useState([
    { name: 'Navkar Mantra', pts: 10 },
    { name: 'Logassa Sutra', pts: 20 },
    { name: 'Uvasaggaharam Stotra', pts: 20 },
    { name: 'Bhaktamar Stotra', pts: 50 },
    { name: 'Namutthunam Sutra', pts: 15 },
    { name: 'Aarti', pts: 10 }
  ]);
  const [lateCutoff, setLateCutoff] = useState({ hour: 9, minute: 15 });

  // Toast state
  const [toast, setToast] = useState(null);  // { msg, color }
  const toastAnim = useRef(new Animated.Value(-80)).current;

  // Gatha modal state
  const [gathaModal, setGathaModal] = useState(false);
  const [modalStudent, setModalStudent] = useState(null);
  const [selectedGathas, setSelectedGathas] = useState({});  // { gathaName: true/false }
  const [customGatha, setCustomGatha] = useState('');
  const [customPts, setCustomPts] = useState('');
  const [gathaSubmitting, setGathaSubmitting] = useState(false);

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
        if (settingsJson.success && settingsJson.data) {
          const settings = settingsJson.data;
          if (settings.gathaList && settings.gathaList.length > 0) {
            setGathaList(settings.gathaList);
          }
          if (settings.lateCutoffTime) {
            const parts = settings.lateCutoffTime.split(':');
            setLateCutoff({
              hour: parseInt(parts[0]) || 9,
              minute: parseInt(parts[1]) || 15
            });
          }
        }
      } catch (err) {
        console.error('AsyncStorage or settings read error:', err);
      }
    };
    loadTeacherDataAndSettings();
    return () => clearTimeout(cooldownRef.current);
  }, []);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = (msg, color = '#22c55e') => {
    setToast({ msg, color });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: -80, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  // ── Find student by rollNo (direct lookup — no full list fetch) ───────────────────
  const findStudent = async (rollNo) => {
    const res = await fetch(`${API_BASE}/students/by-roll/${encodeURIComponent(String(rollNo).trim())}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Server error looking up student.');
    const json = await res.json();
    return json.success ? json.data : null;
  };

  // ── Check if already marked today ───────────────────────────────────────
  const alreadyMarkedToday = (student) => {
    const today = todayString();
    return (student.attendanceLogs || []).some(l => l.date === today);
  };

  // ── Main scan handler ─────────────────────────────────────────────────────
  const handleBarcode = async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      const student = await findStudent(data);

      if (!student) {
        showToast('❓ Unknown QR Code', '#ef4444');
        return;
      }

      // ── ATTENDANCE MODE ────────────────────────────────────────────────
      if (mode === 'Attendance') {
        if (alreadyMarkedToday(student)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          showToast(`⚠️  ${student.name} already marked today`, '#f59e0b');
          return;
        }
        const now = new Date();
        const isLate = now.getHours() > lateCutoff.hour ||
          (now.getHours() === lateCutoff.hour && now.getMinutes() >= lateCutoff.minute);
        const status = isLate ? 'Late' : 'Present';
        const pts = isLate ? 5 : 10;

        const token = await AsyncStorage.getItem('userToken');
        const res = await fetch(`${API_BASE}/students/${student._id}/attendance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status, date: todayString(), loggedBy: teacherName }),
        });
        const respData = await res.json();
        
        if (!res.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          showToast(`⚠️  ${respData.message || 'Error marking attendance'}`, '#f59e0b');
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(
          isLate
            ? `🕐  ${student.name} — Late +${pts} pts`
            : `✅  ${student.name} — Present +${pts} pts`,
          isLate ? '#f59e0b' : '#22c55e'
        );
      }

      // ── GATHA MODE ────────────────────────────────────────────────────
      else if (mode === 'Gatha') {
        setModalStudent(student);
        setSelectedGathas({});
        setCustomGatha('');
        setCustomPts('');
        setGathaModal(true);
      }

      // ── GENERAL MODE ──────────────────────────────────────────────────
      else {
        navigation.navigate('Classes', {
          screen: 'StudentProfile',
          params: { student },
        });
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('❌ Error — try again', '#ef4444');
    } finally {
      setProcessing(false);
      cooldownRef.current = setTimeout(() => setScanned(false), SCAN_COOLDOWN_MS);
    }
  };

  // ── Submit Gathas ──────────────────────────────────────────────────────
  const submitGathas = async () => {
    if (!modalStudent) return;
    const items = gathaList.filter(g => selectedGathas[g.name]);
    if (customGatha.trim() && Number(customPts) > 0) {
      items.push({ name: customGatha.trim(), pts: Number(customPts) });
    }
    if (items.length === 0) {
      Alert.alert('Select at least one Gatha');
      return;
    }
    setGathaSubmitting(true);
    try {
      // Bulk POST — one request per Gatha type (activity)
      const token = await AsyncStorage.getItem('userToken');
      for (const g of items) {
        const res = await fetch(`${API_BASE}/students/${modalStudent._id}/activity`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ type: 'Gatha', description: g.name, pointsAwarded: g.pts, date: todayString(), loggedBy: teacherName }),
        });
        if (!res.ok) throw new Error('Failed to save activity');
      }
      const totalPts = items.reduce((a, g) => a + g.pts, 0);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGathaModal(false);
      showToast(`✅  +${totalPts} pts awarded to ${modalStudent.name}`, '#22c55e');
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not save Gatha points.');
    } finally {
      setGathaSubmitting(false);
    }
  };

  // ── Permission screens ─────────────────────────────────────────────────
  if (!permission) {
    return <View style={styles.centered}><ActivityIndicator color="#6366f1" size="large" /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>📷 Camera Access Needed</Text>
        <Text style={styles.permSub}>ShrutMandir needs camera access to scan student QR codes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Camera ── */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
      />

      {/* ── Dark overlay ── */}
      <View style={styles.overlay}>

        {/* Top bar with mode switcher */}
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>🎵 ShrutMandir</Text>
          <View style={styles.segmentControl}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.segment, mode === m && styles.segmentActive]}
                onPress={() => { setMode(m); setScanned(false); }}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modeHint}>
            {mode === 'Attendance' && 'Scan to mark Present / Late'}
            {mode === 'Gatha' && 'Scan to log Gatha recital'}
            {mode === 'General' && 'Scan to open student profile'}
          </Text>
        </View>

        {/* Reticle */}
        <View style={styles.reticleRow}>
          <View style={styles.sideFill} />
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>
          <View style={styles.sideFill} />
        </View>

        {/* Bottom status */}
        <View style={styles.bottomBar}>
          {processing
            ? <View style={styles.processingRow}><ActivityIndicator color="#fff" size="small" /><Text style={styles.processingText}>  Processing…</Text></View>
            : <Text style={styles.idleText}>Waiting for QR code…</Text>
          }
          <TouchableOpacity style={styles.resetBtn} onPress={() => setScanned(false)}>
            <Text style={styles.resetBtnText}>🔄  Reset Scanner</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Toast Banner ── */}
      {toast && (
        <Animated.View style={[styles.toast, { backgroundColor: toast.color, transform: [{ translateY: toastAnim }] }]}>
          <Text style={styles.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}

      {/* ── Gatha Modal ── */}
      <Modal visible={gathaModal} animationType="slide" transparent onRequestClose={() => setGathaModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalStudent?.name}</Text>
            <Text style={styles.modalSub}>⭐ {modalStudent?.points ?? 0} pts  ·  Select Gathas completed</Text>

            <ScrollView style={styles.gathaList} showsVerticalScrollIndicator={false}>
              {gathaList.map(g => {
                const selected = !!selectedGathas[g.name];
                return (
                  <TouchableOpacity
                    key={g.name}
                    style={[styles.gathaRow, selected && styles.gathaRowSelected]}
                    onPress={() => setSelectedGathas(prev => ({ ...prev, [g.name]: !prev[g.name] }))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.gathaCheck}>{selected ? '☑' : '☐'}</Text>
                    <Text style={styles.gathaName}>{g.name}</Text>
                    <Text style={styles.gathaPoints}>+{g.pts} pts</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Custom Gatha */}
              <View style={styles.customBlock}>
                <Text style={styles.customLabel}>Custom Gatha / Aaradhana</Text>
                <TextInput
                  style={styles.customInput}
                  placeholder="Gatha name…"
                  placeholderTextColor="#4c4f6b"
                  value={customGatha}
                  onChangeText={setCustomGatha}
                />
                <TextInput
                  style={styles.customInput}
                  placeholder="Points…"
                  placeholderTextColor="#4c4f6b"
                  keyboardType="numeric"
                  value={customPts}
                  onChangeText={setCustomPts}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setGathaModal(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitModalBtn, gathaSubmitting && { opacity: 0.5 }]}
                onPress={submitGathas}
                disabled={gathaSubmitting}
              >
                {gathaSubmitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitModalBtnText}>Submit Gatha Points</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const RETICLE = 240;
const CORNER = 24;
const CW = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center', padding: 32 },

  permTitle: { color: '#e0e7ff', fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  permSub: { color: '#818cf8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  overlay: { flex: 1 },

  topBar: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center',
  },
  topTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },

  segmentControl: { flexDirection: 'row', backgroundColor: '#0f0e17aa', borderRadius: 12, padding: 4, marginBottom: 10 },
  segment: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  segmentActive: { backgroundColor: '#6366f1' },
  segmentText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  modeHint: { color: '#c7d2fe', fontSize: 12 },

  reticleRow: { flexDirection: 'row', height: RETICLE },
  sideFill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  reticle: { width: RETICLE, height: RETICLE, backgroundColor: 'transparent' },

  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#6366f1' },
  cTL: { top: 0, left: 0, borderTopWidth: CW, borderLeftWidth: CW },
  cTR: { top: 0, right: 0, borderTopWidth: CW, borderRightWidth: CW },
  cBL: { bottom: 0, left: 0, borderBottomWidth: CW, borderLeftWidth: CW },
  cBR: { bottom: 0, right: 0, borderBottomWidth: CW, borderRightWidth: CW },

  bottomBar: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 30,
  },
  processingRow: { flexDirection: 'row', alignItems: 'center' },
  processingText: { color: '#fff', fontSize: 15 },
  idleText: { color: '#c7d2fe', fontSize: 14 },
  resetBtn: { backgroundColor: 'rgba(99,102,241,0.25)', borderWidth: 1, borderColor: '#6366f1', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  resetBtnText: { color: '#a5b4fc', fontSize: 14, fontWeight: '600' },

  // Toast
  toast: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },

  // Gatha Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingHorizontal: 20, maxHeight: '80%' },
  modalTitle: { color: '#e0e7ff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalSub: { color: '#818cf8', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  gathaList: { maxHeight: 360 },
  gathaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#312e81' },
  gathaRowSelected: { backgroundColor: '#312e8155', borderRadius: 8 },
  gathaCheck: { fontSize: 20, color: '#818cf8', marginRight: 12, width: 24 },
  gathaName: { flex: 1, color: '#e0e7ff', fontSize: 14 },
  gathaPoints: { color: '#22c55e', fontSize: 13, fontWeight: '700' },

  customBlock: { paddingVertical: 14, gap: 8 },
  customLabel: { color: '#818cf8', fontSize: 12, fontWeight: '600' },
  customInput: { backgroundColor: '#0f0e17', borderRadius: 8, borderWidth: 1, borderColor: '#312e81', color: '#e0e7ff', padding: 10, fontSize: 14 },

  modalFooter: { flexDirection: 'row', gap: 10, paddingVertical: 16 },
  cancelModalBtn: { flex: 1, backgroundColor: '#312e81', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelModalBtnText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  submitModalBtn: { flex: 2, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitModalBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
