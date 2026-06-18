import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar,
  ActivityIndicator, Modal, ScrollView, TextInput, Animated, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE } from '../config';
import LegalFooter from '../components/LegalFooter';

// ── Constants ────────────────────────────────────────────────────────────────
const SCAN_COOLDOWN_MS = 800; // Reduced — cache makes lookups instant
const { width: SCREEN_W } = Dimensions.get('window');
const RETICLE = 240;
const CORNER = 26;
const CW = 4;

const MODES = ['Attendance', 'Gatha', 'General'];

// IST = UTC+5:30
function todayString() {
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().split('T')[0];
}

// ── Offline Queue helpers ─────────────────────────────────────────────────────
const QUEUE_KEY = 'attendance_offline_queue';

async function loadQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveQueue(queue) {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

async function flushQueue(token) {
  const queue = await loadQueue();
  if (queue.length === 0) return;
  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(`${API_BASE}/students/${item.studentId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) remaining.push(item);
    } catch { remaining.push(item); }
  }
  await saveQueue(remaining);
  return queue.length - remaining.length; // how many flushed
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('Attendance');
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Local student cache ───────────────────────────────────────────────────
  const [studentCache, setStudentCache] = useState({}); // { rollNo: studentObj }
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0); // pending offline items

  // ── Session scan log ──────────────────────────────────────────────────────
  const [sessionLog, setSessionLog] = useState([]); // [{ name, status, time, pts }]

  // ── Last scanned card ─────────────────────────────────────────────────────
  const [lastScan, setLastScan] = useState(null); // { name, className, status, pts }
  const lastScanAnim = useRef(new Animated.Value(0)).current;
  const lastScanTimer = useRef(null);

  const cooldownRef = useRef(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const [teacherName, setTeacherName] = useState('Unknown Teacher');
  const [userToken, setUserToken] = useState(null);

  const [gathaList, setGathaList] = useState([
    { name: 'Navkar Mantra', pts: 10 },
    { name: 'Logassa Sutra', pts: 20 },
    { name: 'Uvasaggaharam Stotra', pts: 20 },
    { name: 'Bhaktamar Stotra', pts: 50 },
    { name: 'Namutthunam Sutra', pts: 15 },
    { name: 'Aarti', pts: 10 },
  ]);
  const [lateCutoff, setLateCutoff] = useState({ hour: 9, minute: 15 });

  const [toast, setToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(-80)).current;

  const [gathaModal, setGathaModal] = useState(false);
  const [modalStudent, setModalStudent] = useState(null);
  const [selectedGathas, setSelectedGathas] = useState({});
  const [customGatha, setCustomGatha] = useState('');
  const [customPts, setCustomPts] = useState('');
  const [gathaSubmitting, setGathaSubmitting] = useState(false);

  // ── Scan-line animation ───────────────────────────────────────────────────
  useEffect(() => {
    const runAnim = () => {
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]).start(runAnim);
    };
    runAnim();
  }, [scanLineAnim]);

  // ── Init: load teacher, settings, student cache, flush offline queue ──────
  useEffect(() => {
    const init = async () => {
      try {
        // Load teacher & token
        const userDataStr = await AsyncStorage.getItem('userData');
        const token = await AsyncStorage.getItem('userToken');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setTeacherName(userData.name || 'Unknown Teacher');
        }
        if (token) setUserToken(token);

        // Flush offline queue in background
        if (token) {
          const flushed = await flushQueue(token);
          if (flushed > 0) showToast(`📡 Synced ${flushed} offline record${flushed > 1 ? 's' : ''}`, '#6366f1');
        }
        const queue = await loadQueue();
        setOfflineCount(queue.length);

        // Load settings
        const settingsRes = await fetch(`${API_BASE}/settings`);
        const settingsJson = await settingsRes.json();
        if (settingsJson.success && settingsJson.data) {
          const s = settingsJson.data;
          if (s.gathaList?.length > 0) setGathaList(s.gathaList);
          if (s.lateCutoffTime) {
            const parts = s.lateCutoffTime.split(':');
            setLateCutoff({ hour: parseInt(parts[0]) || 9, minute: parseInt(parts[1]) || 15 });
          }
        }

        // 🚀 Pre-load student cache — this is the key speed improvement
        const studentsRes = await fetch(`${API_BASE}/students`);
        const studentsJson = await studentsRes.json();
        if (studentsJson.success && studentsJson.data) {
          const cache = {};
          for (const s of studentsJson.data) {
            cache[String(s.rollNo).trim()] = s;
          }
          setStudentCache(cache);
        }
        setCacheLoaded(true);
      } catch (err) {
        console.error('Init error:', err);
        setCacheLoaded(true); // allow use even if cache fails
      }
    };
    init();
    return () => {
      clearTimeout(cooldownRef.current);
      clearTimeout(lastScanTimer.current);
    };
  }, []);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg, color = '#22c55e') => {
    setToast({ msg, color });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: -80, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  // ── Show last-scan card ───────────────────────────────────────────────────
  const showLastScan = useCallback((info) => {
    clearTimeout(lastScanTimer.current);
    setLastScan(info);
    Animated.spring(lastScanAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    lastScanTimer.current = setTimeout(() => {
      Animated.timing(lastScanAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setLastScan(null));
    }, 3000);
  }, [lastScanAnim]);

  // ── Find student from cache (instant) ─────────────────────────────────────
  const findStudentFromCache = useCallback((rollNo) => {
    const key = String(rollNo).trim();
    return studentCache[key] || null;
  }, [studentCache]);

  // ── Fallback: server lookup (if cache misses) ─────────────────────────────
  const findStudentFromServer = useCallback(async (rollNo) => {
    const res = await fetch(`${API_BASE}/students/by-roll/${encodeURIComponent(String(rollNo).trim())}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Server error');
    const json = await res.json();
    return json.success ? json.data : null;
  }, []);

  const alreadyMarkedToday = useCallback((student) => {
    const today = todayString();
    return (student.attendanceLogs || []).some(l => l.date === today);
  }, []);

  // ── Stable no-op ─────────────────────────────────────────────────────────
  const noOp = useCallback(() => {}, []);

  // ── Main scan handler ─────────────────────────────────────────────────────
  const handleBarcode = useCallback(async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      // 🚀 Try cache first — usually instant
      let student = findStudentFromCache(data);
      if (!student) {
        // Cache miss — fall back to server
        student = await findStudentFromServer(data);
        // Update cache with found student
        if (student) {
          setStudentCache(prev => ({ ...prev, [String(student.rollNo).trim()]: student }));
        }
      }

      if (!student) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast('❓ Unknown QR Code', '#ef4444');
        return;
      }

      // ── ATTENDANCE MODE ──────────────────────────────────────────────────
      if (mode === 'Attendance') {
        if (alreadyMarkedToday(student)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          showToast(`⚠️  ${student.name} already marked today`, '#f59e0b');
          showLastScan({ name: student.name, className: student.classId?.className || student.village || '—', status: 'Already Marked', pts: 0, color: '#f59e0b' });
          return;
        }

        const now = new Date();
        const isLate = now.getHours() > lateCutoff.hour ||
          (now.getHours() === lateCutoff.hour && now.getMinutes() >= lateCutoff.minute);
        const status = isLate ? 'Late' : 'Present';
        const pts = isLate ? 5 : 10;

        const body = { status, date: todayString(), loggedBy: teacherName };

        try {
          const token = await AsyncStorage.getItem('userToken');
          const res = await fetch(`${API_BASE}/students/${student._id}/attendance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          });
          const respData = await res.json();

          if (!res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showToast(`⚠️  ${respData.message || 'Error marking attendance'}`, '#f59e0b');
            return;
          }
        } catch {
          // 📶 Network failed — queue for later
          const queue = await loadQueue();
          queue.push({ studentId: student._id, body });
          await saveQueue(queue);
          setOfflineCount(prev => prev + 1);
          showToast(`📶 Offline — queued for sync`, '#818cf8');
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const toastMsg = isLate ? `🕐  ${student.name} — Late +${pts} pts` : `✅  ${student.name} — Present +${pts} pts`;
        showToast(toastMsg, isLate ? '#f59e0b' : '#22c55e');

        // Update local cache so re-scan shows "already marked"
        setStudentCache(prev => ({
          ...prev,
          [String(student.rollNo).trim()]: {
            ...student,
            attendanceLogs: [...(student.attendanceLogs || []), { date: todayString(), status }],
          },
        }));

        // Show last-scan card
        showLastScan({
          name: student.name,
          className: student.classId?.className || student.village || '—',
          status,
          pts,
          color: isLate ? '#f59e0b' : '#22c55e',
        });

        // Add to session log
        setSessionLog(prev => [{
          name: student.name,
          className: student.classId?.className || student.village || '—',
          status,
          pts,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        }, ...prev]);
      }

      // ── GATHA MODE ──────────────────────────────────────────────────────
      else if (mode === 'Gatha') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setModalStudent(student);
        setSelectedGathas({});
        setCustomGatha('');
        setCustomPts('');
        setGathaModal(true);
      }

      // ── GENERAL MODE ────────────────────────────────────────────────────
      else {
        navigation.navigate('Classes', { screen: 'StudentProfile', params: { student } });
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('❌ Error — try again', '#ef4444');
    } finally {
      setProcessing(false);
      cooldownRef.current = setTimeout(() => setScanned(false), SCAN_COOLDOWN_MS);
    }
  }, [scanned, processing, mode, teacherName, lateCutoff, findStudentFromCache, findStudentFromServer, alreadyMarkedToday, showToast, showLastScan, navigation]);

  // ── Submit Gathas ──────────────────────────────────────────────────────────
  const submitGathas = async () => {
    if (!modalStudent) return;
    const items = gathaList.filter(g => selectedGathas[g.name]);
    if (customGatha.trim() && Number(customPts) > 0) {
      items.push({ name: customGatha.trim(), pts: Number(customPts) });
    }
    if (items.length === 0) { Alert.alert('Select at least one Gatha'); return; }
    setGathaSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      for (const g of items) {
        const res = await fetch(`${API_BASE}/students/${modalStudent._id}/activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ type: 'Gatha', description: g.name, pointsAwarded: g.pts, date: todayString(), loggedBy: teacherName }),
        });
        if (!res.ok) throw new Error('Failed');
      }
      const totalPts = items.reduce((a, g) => a + g.pts, 0);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGathaModal(false);
      showToast(`✅  +${totalPts} pts → ${modalStudent.name}`, '#22c55e');
      setSessionLog(prev => [{
        name: modalStudent.name,
        className: modalStudent.classId?.className || '—',
        status: 'Gatha',
        pts: totalPts,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }, ...prev]);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not save Gatha points.');
    } finally {
      setGathaSubmitting(false);
    }
  };

  // ── Permission screens ────────────────────────────────────────────────────
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

  const scanCount = sessionLog.filter(l => l.status !== 'Gatha').length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Camera ── */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? noOp : handleBarcode}
      />

      {/* ── Dark overlay ── */}
      <View style={styles.overlay}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.topRow}>
            <Text style={styles.topTitle}>🎵 ShrutMandir</Text>
            <View style={styles.topActions}>
              {/* Torch button */}
              <TouchableOpacity
                style={[styles.iconBtn, torchOn && styles.iconBtnActive]}
                onPress={() => setTorchOn(t => !t)}
              >
                <Text style={styles.iconBtnText}>{torchOn ? '🔦' : '💡'}</Text>
              </TouchableOpacity>
              {/* History button */}
              <TouchableOpacity
                style={[styles.iconBtn, sessionLog.length > 0 && styles.iconBtnActive]}
                onPress={() => setHistoryOpen(true)}
              >
                <Text style={styles.iconBtnText}>📋</Text>
                {sessionLog.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{sessionLog.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode switcher */}
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

          {/* Status row: cache + scan count + offline queue */}
          <View style={styles.statusRow}>
            <Text style={styles.statusChip}>
              {cacheLoaded ? `⚡ ${Object.keys(studentCache).length} students cached` : '⏳ Loading cache…'}
            </Text>
            {mode === 'Attendance' && scanCount > 0 && (
              <Text style={styles.statusChip}>✅ {scanCount} scanned</Text>
            )}
            {offlineCount > 0 && (
              <Text style={[styles.statusChip, { backgroundColor: 'rgba(129,140,248,0.25)', borderColor: '#818cf8' }]}>
                📶 {offlineCount} queued
              </Text>
            )}
          </View>
        </View>

        {/* Reticle */}
        <View style={styles.reticleRow}>
          <View style={styles.sideFill} />
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
            {/* Animated scan line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{
                    translateY: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, RETICLE - 4],
                    }),
                  }],
                },
              ]}
            />
          </View>
          <View style={styles.sideFill} />
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {/* Last-scan preview card */}
          {lastScan && (
            <Animated.View
              style={[
                styles.lastScanCard,
                { borderLeftColor: lastScan.color, opacity: lastScanAnim, transform: [{ scale: lastScanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.lastScanName}>{lastScan.name}</Text>
                <Text style={styles.lastScanClass}>{lastScan.className}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.lastScanStatus, { color: lastScan.color }]}>{lastScan.status}</Text>
                {lastScan.pts > 0 && <Text style={styles.lastScanPts}>+{lastScan.pts} pts</Text>}
              </View>
            </Animated.View>
          )}

          {processing
            ? <View style={styles.processingRow}><ActivityIndicator color="#fff" size="small" /><Text style={styles.processingText}>  Processing…</Text></View>
            : <Text style={styles.idleText}>
                {cacheLoaded ? 'Ready — point at QR code' : 'Loading student data…'}
              </Text>
          }
          <TouchableOpacity style={styles.resetBtn} onPress={() => setScanned(false)}>
            <Text style={styles.resetBtnText}>🔄  Reset Scanner</Text>
          </TouchableOpacity>
          <LegalFooter />
        </View>
      </View>

      {/* ── Toast Banner ── */}
      {toast && (
        <Animated.View style={[styles.toast, { backgroundColor: toast.color, transform: [{ translateY: toastAnim }] }]}>
          <Text style={styles.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}

      {/* ── Session History Modal ── */}
      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.modalTitle}>📋 This Session</Text>
              <TouchableOpacity onPress={() => setHistoryOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{sessionLog.length} record{sessionLog.length !== 1 ? 's' : ''} logged</Text>

            {sessionLog.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: '#818cf8', fontSize: 14 }}>No scans yet this session</Text>
              </View>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {sessionLog.map((item, idx) => (
                  <View key={idx} style={styles.historyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyName}>{item.name}</Text>
                      <Text style={styles.historyClass}>{item.className} · {item.time}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.historyStatus, {
                        color: item.status === 'Present' ? '#22c55e' : item.status === 'Late' ? '#f59e0b' : item.status === 'Gatha' ? '#818cf8' : '#94a3b8'
                      }]}>{item.status}</Text>
                      {item.pts > 0 && <Text style={styles.historyPts}>+{item.pts}</Text>}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
              <View style={styles.customBlock}>
                <Text style={styles.customLabel}>Custom Gatha / Aaradhana</Text>
                <TextInput style={styles.customInput} placeholder="Gatha name…" placeholderTextColor="#4c4f6b" value={customGatha} onChangeText={setCustomGatha} />
                <TextInput style={styles.customInput} placeholder="Points…" placeholderTextColor="#4c4f6b" keyboardType="numeric" value={customPts} onChangeText={setCustomPts} />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setGathaModal(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitModalBtn, gathaSubmitting && { opacity: 0.5 }]} onPress={submitGathas} disabled={gathaSubmitting}>
                {gathaSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitModalBtnText}>Submit Gatha Points</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center', padding: 32 },

  permTitle: { color: '#e0e7ff', fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  permSub: { color: '#818cf8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  overlay: { flex: 1 },

  // ── Top bar ──
  topBar: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingTop: 54, paddingBottom: 16, paddingHorizontal: 18, alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginBottom: 14,
  },
  topTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  topActions: { flexDirection: 'row', gap: 10 },

  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  iconBtnActive: { backgroundColor: 'rgba(99,102,241,0.35)', borderWidth: 1, borderColor: '#6366f1' },
  iconBtnText: { fontSize: 18 },
  badge: {
    position: 'absolute', top: -5, right: -5, backgroundColor: '#6366f1',
    borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  segmentControl: { flexDirection: 'row', backgroundColor: '#0f0e17aa', borderRadius: 12, padding: 4, marginBottom: 8 },
  segment: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  segmentActive: { backgroundColor: '#6366f1' },
  segmentText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  modeHint: { color: '#c7d2fe', fontSize: 12, marginBottom: 10 },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  statusChip: {
    fontSize: 11, color: '#a5b4fc', fontWeight: '600',
    backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },

  // ── Reticle ──
  reticleRow: { flexDirection: 'row', height: RETICLE },
  sideFill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  reticle: { width: RETICLE, height: RETICLE, backgroundColor: 'transparent' },

  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#6366f1' },
  cTL: { top: 0, left: 0, borderTopWidth: CW, borderLeftWidth: CW },
  cTR: { top: 0, right: 0, borderTopWidth: CW, borderRightWidth: CW },
  cBL: { bottom: 0, left: 0, borderBottomWidth: CW, borderLeftWidth: CW },
  cBR: { bottom: 0, right: 0, borderBottomWidth: CW, borderRightWidth: CW },

  scanLine: { position: 'absolute', left: 6, right: 6, height: 2, backgroundColor: '#6366f1', borderRadius: 1, opacity: 0.95 },

  // ── Bottom bar ──
  bottomBar: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 28, paddingHorizontal: 20,
  },
  processingRow: { flexDirection: 'row', alignItems: 'center' },
  processingText: { color: '#fff', fontSize: 15 },
  idleText: { color: '#c7d2fe', fontSize: 14 },
  resetBtn: { backgroundColor: 'rgba(99,102,241,0.25)', borderWidth: 1, borderColor: '#6366f1', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  resetBtnText: { color: '#a5b4fc', fontSize: 14, fontWeight: '600' },

  // ── Last-scan preview card ──
  lastScanCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(15,14,23,0.92)', borderRadius: 14,
    borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 10,
    width: '100%', marginBottom: 4,
  },
  lastScanName: { color: '#e0e7ff', fontSize: 15, fontWeight: '700' },
  lastScanClass: { color: '#818cf8', fontSize: 12, marginTop: 1 },
  lastScanStatus: { fontSize: 13, fontWeight: '700' },
  lastScanPts: { color: '#94a3b8', fontSize: 12 },

  // ── Toast ──
  toast: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 54, paddingBottom: 14, paddingHorizontal: 20, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },

  // ── Modals ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, maxHeight: '82%' },
  modalTitle: { color: '#e0e7ff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalSub: { color: '#818cf8', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 14 },

  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: '#818cf8', fontSize: 18 },
  historyList: { maxHeight: 380 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#312e81',
  },
  historyName: { color: '#e0e7ff', fontSize: 14, fontWeight: '600' },
  historyClass: { color: '#818cf8', fontSize: 12, marginTop: 2 },
  historyStatus: { fontSize: 13, fontWeight: '700' },
  historyPts: { color: '#22c55e', fontSize: 12, fontWeight: '600' },

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
