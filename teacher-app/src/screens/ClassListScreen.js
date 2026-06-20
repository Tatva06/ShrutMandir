import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, StatusBar, RefreshControl, Platform,
  ScrollView, Modal, TextInput, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE } from '../config';
import LegalFooter from '../components/LegalFooter';

// IST = UTC+5:30 — arithmetic avoids Intl timezone API (which can fail in some envs)
function todayString() {
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().split('T')[0]; // always 'YYYY-MM-DD'
}

const STATUS_CONFIG = {
  Present: { color: '#4ADE80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.3)', icon: '✅', pts: '+10 pts' },
  Absent:  { color: '#FB7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.3)', icon: '❌', pts: '0 pts'   },
  Late:    { color: '#FBB040', bg: 'rgba(251,176,64,0.1)',  border: 'rgba(251,176,64,0.3)',  icon: '🕐', pts: '+5 pts'  },
};

const DEFAULT_GATHA_LIST = [
  { name: 'Navkar Mantra', pts: 10 },
  { name: 'Logassa Sutra', pts: 20 },
  { name: 'Uvasaggaharam Stotra', pts: 20 },
  { name: 'Bhaktamar Stotra', pts: 50 },
  { name: 'Namutthunam Sutra', pts: 15 },
  { name: 'Aarti', pts: 10 },
];

export default function ClassListScreen({ route, navigation }) {
  const { classId, className } = route.params;

  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isLocked,    setIsLocked]    = useState(false);
  const [lockChecked, setLockChecked] = useState(false);

  const [attendanceMode, setAttendanceMode] = useState(false);
  const [statusMap,      setStatusMap]      = useState({});
  const [submitting,     setSubmitting]     = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);

  // ── Present Students View ──────────────────────────────────────────────────
  const [showPresent, setShowPresent] = useState(false);

  // ── Activity Log Modal state ───────────────────────────────────────────────
  const [logModal,       setLogModal]       = useState(false);
  const [logTarget,      setLogTarget]      = useState(null); // student object
  const [logType,        setLogType]        = useState('Gatha');
  const [selectedGathas, setSelectedGathas] = useState({});
  const [customDesc,     setCustomDesc]     = useState('');
  const [customPts,      setCustomPts]      = useState('');
  const [submittingLog,  setSubmittingLog]  = useState(false);
  const [gathaList,      setGathaList]      = useState(DEFAULT_GATHA_LIST);
  const [teacherName,    setTeacherName]    = useState('Unknown Teacher');
  const [userToken,      setUserToken]      = useState('');

  const today = todayString();

  // ── Load teacher data & settings ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        const token = await AsyncStorage.getItem('userToken');
        if (userDataStr) setTeacherName(JSON.parse(userDataStr).name || 'Unknown Teacher');
        if (token) setUserToken(token);
        const settingsRes = await fetch(`${API_BASE}/settings`);
        const settingsJson = await settingsRes.json();
        if (settingsJson.success && settingsJson.data?.gathaList?.length > 0) {
          setGathaList(settingsJson.data.gathaList);
        }
      } catch {}
    };
    load();
  }, []);

  // ── Fetch students & lock status ──────────────────────────────────────────
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [studRes, lockRes] = await Promise.all([
        fetch(`${API_BASE}/students`),
        fetch(`${API_BASE}/classes/${classId}/attendance-locked/${today}`),
      ]);
      const studJson = await studRes.json();
      const lockJson = await lockRes.json();

      if (studJson.success) {
        const classStudents = studJson.data.filter(s =>
          s.classId === classId || (s.classId && s.classId._id === classId)
        );
        classStudents.sort((a, b) => {
          const na = isNaN(a.rollNo) ? a.rollNo : Number(a.rollNo);
          const nb = isNaN(b.rollNo) ? b.rollNo : Number(b.rollNo);
          return na < nb ? -1 : na > nb ? 1 : 0;
        });
        setStudents(classStudents);
        if (!isRefresh) {
          const init = {};
          classStudents.forEach(s => { init[s._id] = 'Absent'; });
          setStatusMap(init);
        }
      }
      if (lockJson.success !== undefined) {
        setIsLocked(lockJson.locked ?? false);
        setLockChecked(true);
      }
    } catch {
      // Silent fail — UI will show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const todayLog = (student) =>
    (student.attendanceLogs || []).find(l => l.date === today);

  const presentCount = Object.values(statusMap).filter(v => v === 'Present').length;
  const absentCount  = Object.values(statusMap).filter(v => v === 'Absent').length;
  const lateCount    = Object.values(statusMap).filter(v => v === 'Late').length;

  // Present students from locked attendance
  const presentStudents = students.filter(s => {
    const log = todayLog(s);
    return log && (log.status === 'Present' || log.status === 'Late');
  });

  const toggleStatus = (studentId, status) => {
    setStatusMap(prev => ({ ...prev, [studentId]: status }));
  };

  // ── Submit attendance ──────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (Platform.OS === 'web') {
      setShowConfirm(true);
    } else {
      const { Alert } = require('react-native');
      Alert.alert(
        'Submit Attendance',
        `Submit for ${students.length} students?\n✅ ${presentCount}  ❌ ${absentCount}  🕐 ${lateCount}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: submitAttendance },
        ]
      );
    }
  };

  const submitAttendance = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const userDataStr = await AsyncStorage.getItem('userData');
      const tName = userDataStr ? JSON.parse(userDataStr).name : 'Unknown Teacher';
      const token = await AsyncStorage.getItem('userToken');

      const attendanceData = students.map(s => ({
        studentId: s._id,
        status: statusMap[s._id] || 'Absent',
      }));

      const bulkRes = await fetch(`${API_BASE}/classes/${classId}/bulk-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ date: today, loggedBy: tName, attendanceData }),
      });

      if (!bulkRes.ok) {
        let errMsg = 'Server error';
        try { const e = await bulkRes.json(); errMsg = e.message || errMsg; } catch {}
        throw new Error(errMsg);
      }

      await fetch(`${API_BASE}/classes/${classId}/lock-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ date: today }),
      });

      const pointsMap = { Present: 10, Late: 5, Absent: 0 };
      setStudents(prev => prev.map(s => {
        const status = statusMap[s._id] || 'Absent';
        const existingLog = (s.attendanceLogs || []).find(l => l.date === today);
        if (existingLog) return s;
        return {
          ...s,
          attendanceLogs: [
            ...(s.attendanceLogs || []),
            { date: today, status, pointsAwarded: pointsMap[status] ?? 0, timestamp: new Date().toISOString(), loggedBy: tName },
          ],
        };
      }));

      setAttendanceMode(false);
      setIsLocked(true);

      if (Platform.OS === 'web') {
        window.alert(`✅ Attendance submitted!\n${presentCount} Present · ${absentCount} Absent · ${lateCount} Late`);
      }
    } catch (err) {
      if (Platform.OS === 'web') {
        window.alert(`❌ Error: ${err.message || 'Could not submit. Try again.'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open activity log modal for a student ────────────────────────────────
  const openLogModal = (student) => {
    setLogTarget(student);
    setLogType('Gatha');
    setSelectedGathas({});
    setCustomDesc('');
    setCustomPts('');
    setLogModal(true);
  };

  // ── Submit activity log ───────────────────────────────────────────────────
  const submitActivity = async () => {
    if (!logTarget) return;
    const items = [];

    if (logType === 'Gatha') {
      gathaList.filter(g => selectedGathas[g.name]).forEach(g =>
        items.push({ type: 'Gatha', description: g.name, pointsAwarded: g.pts })
      );
      if (customDesc.trim() && Number(customPts) !== 0) {
        items.push({ type: 'Gatha', description: customDesc.trim(), pointsAwarded: Number(customPts) });
      }
    } else if (logType === 'Aaradhana') {
      if (!customDesc.trim() || !customPts) {
        Platform.OS === 'web'
          ? window.alert('Fill in description and points.')
          : require('react-native').Alert.alert('Fill in description and points.');
        return;
      }
      items.push({ type: 'Aaradhana', description: customDesc.trim(), pointsAwarded: Number(customPts) });
    } else {
      if (!customDesc.trim() || !customPts) {
        Platform.OS === 'web'
          ? window.alert('Fill in description and points.')
          : require('react-native').Alert.alert('Fill in description and points.');
        return;
      }
      items.push({ type: 'Conduct', description: customDesc.trim(), pointsAwarded: -Math.abs(Number(customPts)) });
    }

    if (items.length === 0) {
      Platform.OS === 'web'
        ? window.alert('Select at least one item.')
        : require('react-native').Alert.alert('Select at least one item.');
      return;
    }

    setSubmittingLog(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      await Promise.all(
        items.map(item =>
          fetch(`${API_BASE}/students/${logTarget._id}/activity`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ ...item, date: today, loggedBy: teacherName }),
          })
        )
      );
      setLogModal(false);
      setLogTarget(null);
      // Refresh students so points reflect
      fetchAll(true);
    } catch {
      Platform.OS === 'web'
        ? window.alert('Could not save activity log.')
        : require('react-native').Alert.alert('Error', 'Could not save activity log.');
    } finally {
      setSubmittingLog(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8682ff" />
        <Text style={styles.loadingText}>Loading students…</Text>
      </View>
    );
  }

  // ── Present Students Modal ─────────────────────────────────────────────────
  if (showPresent) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0d15" />

        {/* Activity Log Modal */}
        <Modal visible={logModal} animationType="slide" transparent onRequestClose={() => setLogModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Log Activity</Text>
              <Text style={styles.modalSub}>{logTarget?.name}</Text>

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
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLogModal(false)}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, submittingLog && { opacity: 0.5 }]}
                  onPress={submitActivity}
                  disabled={submittingLog}
                >
                  {submittingLog
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.modalSubmitBtnText}>Submit</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <FlatList
          data={presentStudents}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#8682ff" />
          }
          ListHeaderComponent={
            <>
              {/* Header */}
              <View style={styles.presentHeader}>
                <Image
                  source={require('../../assets/shrutmandir-logo.jpg')}
                  style={styles.presentLogo}
                  resizeMode="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.presentTitle}>Present Students</Text>
                  <Text style={styles.presentSub}>{className}  ·  {today}</Text>
                </View>
                <TouchableOpacity style={styles.backBtn} onPress={() => setShowPresent(false)}>
                  <Text style={styles.backBtnText}>✕ Close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.presentStatRow}>
                <View style={[styles.presentStat, { borderColor: 'rgba(74,222,128,0.4)' }]}>
                  <Text style={[styles.presentStatNum, { color: '#4ADE80' }]}>{presentStudents.length}</Text>
                  <Text style={[styles.presentStatLabel, { color: '#4ADE80' }]}>Present / Late</Text>
                </View>
                <View style={[styles.presentStat, { borderColor: 'rgba(134,130,255,0.4)' }]}>
                  <Text style={[styles.presentStatNum, { color: '#8682ff' }]}>{students.length}</Text>
                  <Text style={[styles.presentStatLabel, { color: '#8682ff' }]}>Total</Text>
                </View>
              </View>

              <Text style={styles.countLabel}>Tap ➕ to log activity for a student</Text>
            </>
          }
          renderItem={({ item }) => {
            const log = todayLog(item);
            const cfg = STATUS_CONFIG[log?.status] || STATUS_CONFIG.Present;
            const nameParts = (item.name || '').trim().split(/\s+/);
            const initials  = (nameParts[0]?.[0] ?? '') + (nameParts[1]?.[0] ?? '');
            return (
              <View style={[styles.presentCard, { borderColor: cfg.border }]}>
                <TouchableOpacity
                  style={styles.presentCardLeft}
                  onPress={() => navigation.navigate('StudentProfile', { student: item })}
                  activeOpacity={0.75}
                >
                  <View style={[styles.presentAvatar, { borderColor: cfg.color + '55' }]}>
                    <Text style={styles.presentAvatarText}>{initials.toUpperCase()}</Text>
                  </View>
                  <View style={styles.presentNameBlock}>
                    <Text style={styles.presentName}>{item.name}</Text>
                    <Text style={styles.presentSub2}>Roll {item.rollNo}  ·  ⭐ {item.points || 0} pts</Text>
                    <View style={[styles.statusChip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                      <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>
                        {cfg.icon}  {log?.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.logBtn} onPress={() => openLogModal(item)} activeOpacity={0.8}>
                  <Text style={styles.logBtnText}>➕{'\n'}Log</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🙏</Text>
              <Text style={styles.emptyText}>No students marked present yet for today.</Text>
            </View>
          }
          ListFooterComponent={<LegalFooter />}
        />
      </SafeAreaView>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0d15" />

      {/* ── Web-native confirm dialog ─────────────────────────────────────── */}
      {showConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Submit Attendance?</Text>
            <Text style={styles.confirmSub}>This will lock today's attendance for {className}.</Text>
            <View style={styles.confirmStats}>
              <StatPill label="Present" count={presentCount}  color="#4ADE80" />
              <StatPill label="Absent"  count={absentCount}   color="#FB7185" />
              <StatPill label="Late"    count={lateCount}     color="#FBB040" />
            </View>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmSubmit} onPress={submitAttendance} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmSubmitText}>Submit ✓</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={students}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#8682ff" />
        }
        ListHeaderComponent={
          <>
            {/* ── Logo Header ── */}
            <View style={styles.logoHeader}>
              <Image
                source={require('../../assets/shrutmandir-logo.jpg')}
                style={styles.headerLogoImg}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.classTitle}>{className}</Text>
                <Text style={styles.classSub}>{students.length} Students · {today}</Text>
              </View>
            </View>

            {/* ── Lock status banner ── */}
            {lockChecked && (
              <View style={[styles.lockBanner, isLocked ? styles.lockBannerLocked : styles.lockBannerOpen]}>
                <Text style={styles.lockBannerText}>
                  {isLocked ? '🔒 Attendance locked for today' : '🔓 Attendance open — not yet submitted'}
                </Text>
              </View>
            )}

            {/* ── Present Students Button (only when locked) ── */}
            {isLocked && (
              <TouchableOpacity
                style={styles.presentBtn}
                onPress={() => setShowPresent(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.presentBtnText}>✅  View Present Students  ({presentStudents.length})</Text>
              </TouchableOpacity>
            )}

            {!isLocked && !attendanceMode && (
              <TouchableOpacity style={styles.takeAttendanceBtn} onPress={() => setAttendanceMode(true)} activeOpacity={0.85}>
                <Text style={styles.takeAttendanceBtnText}>📋  Take Attendance</Text>
              </TouchableOpacity>
            )}

            {attendanceMode && (
              <View style={styles.attendanceHeader}>
                <View style={styles.statRow}>
                  <StatPill label="Present" count={presentCount}  color="#4ADE80" />
                  <StatPill label="Absent"  count={absentCount}   color="#FB7185" />
                  <StatPill label="Late"    count={lateCount}     color="#FBB040" />
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAttendanceMode(false)}>
                  <Text style={styles.cancelBtnText}>✕  Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.countLabel}>{students.length} Students · Sorted by Roll No</Text>
          </>
        }
        renderItem={({ item }) => (
          <StudentCard
            student={item}
            attendanceMode={attendanceMode}
            isLocked={isLocked}
            status={statusMap[item._id]}
            todayLog={todayLog(item)}
            onStatusChange={(s) => toggleStatus(item._id, s)}
            onTap={() => navigation.navigate('StudentProfile', { student: item })}
          />
        )}
        ListFooterComponent={
          <View style={{ paddingBottom: 20 }}>
            {attendanceMode && (
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit Attendance  ·  {presentCount} Present</Text>
                }
              </TouchableOpacity>
            )}
            <LegalFooter />
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatPill({ label, count, color }) {
  return (
    <View style={[styles.statPill, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <Text style={[styles.statPillCount, { color }]}>{count}</Text>
      <Text style={[styles.statPillLabel, { color }]}>{label}</Text>
    </View>
  );
}

function StudentCard({ student, attendanceMode, isLocked, status, todayLog, onStatusChange, onTap }) {
  const nameParts = (student.name || '').trim().split(/\s+/);
  const initials  = (nameParts[0]?.[0] ?? '') + (nameParts[1]?.[0] ?? '');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onTap}
      activeOpacity={attendanceMode ? 1 : 0.75}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentSub}>Roll {student.rollNo}  ·  {student.village || student.classId?.className || '—'}</Text>
        </View>
      </View>

      <Text style={styles.pointsBadge}>⭐ {student.points || 0}</Text>

      {/* Attendance mode: radio pills */}
      {attendanceMode && (
        <View style={styles.radioRow}>
          {['Present', 'Absent', 'Late'].map(s => {
            const cfg    = STATUS_CONFIG[s];
            const active = status === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.pill, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                onPress={() => onStatusChange(s)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, active && { color: '#0f0d15' }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Locked: today's status */}
      {isLocked && !attendanceMode && todayLog && (
        <View style={[styles.statusBadge, {
          backgroundColor: STATUS_CONFIG[todayLog.status]?.bg,
          borderColor: STATUS_CONFIG[todayLog.status]?.border,
        }]}>
          <Text style={{ color: STATUS_CONFIG[todayLog.status]?.color, fontSize: 12, fontWeight: '700' }}>
            {STATUS_CONFIG[todayLog.status]?.icon}  {todayLog.status}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0d15' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d15', gap: 12 },
  loadingText: { color: '#918fa0', fontSize: 15 },
  list:        { padding: 16, paddingBottom: 100 },
  countLabel:  { color: '#918fa0', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  // Logo header
  logoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
    backgroundColor: 'rgba(134,130,255,0.06)',
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(134,130,255,0.15)',
  },
  headerLogoImg: { width: 52, height: 52, borderRadius: 10 },
  classTitle:  { color: '#e6e0ec', fontSize: 18, fontWeight: '800' },
  classSub:    { color: '#918fa0', fontSize: 11, marginTop: 2 },

  // Lock banner
  lockBanner: { borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, alignItems: 'center' },
  lockBannerLocked: { backgroundColor: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.3)' },
  lockBannerOpen:   { backgroundColor: 'rgba(74,222,128,0.08)',  borderColor: 'rgba(74,222,128,0.3)'  },
  lockBannerText:   { fontWeight: '600', color: '#c7c4d6', fontSize: 13 },

  // Present Students button
  presentBtn: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)',
  },
  presentBtnText: { color: '#4ADE80', fontSize: 15, fontWeight: '700' },

  // Attendance mode header
  attendanceHeader: { marginBottom: 14, gap: 10 },
  statRow:          { flexDirection: 'row', gap: 8 },
  statPill: {
    flex: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  statPillCount: { fontSize: 18, fontWeight: '800' },
  statPillLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },

  // Take attendance button
  takeAttendanceBtn: {
    backgroundColor: '#8682ff',
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 14,
    shadowColor: '#8682ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 6,
  },
  takeAttendanceBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  cancelBtn: {
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 9, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cancelBtnText: { color: '#918fa0', fontSize: 13, fontWeight: '600' },

  // Student card
  card: {
    backgroundColor: 'rgba(43,41,50,0.5)',
    borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardLeft:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar:      {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(134,130,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(134,130,255,0.35)',
  },
  avatarText:  { color: '#c3c0ff', fontSize: 15, fontWeight: '700' },
  nameBlock:   { flex: 1 },
  studentName: { color: '#e6e0ec', fontSize: 15, fontWeight: '600' },
  studentSub:  { color: '#918fa0', fontSize: 11, marginTop: 2 },
  pointsBadge: { color: '#FBB040', fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 4 },

  radioRow:  { flexDirection: 'row', gap: 6, marginTop: 4 },
  pill: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pillText:  { color: '#918fa0', fontSize: 11, fontWeight: '700' },

  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, marginTop: 4,
  },

  // Submit button
  submitBtn: {
    borderRadius: 16, paddingVertical: 17, alignItems: 'center', margin: 8,
    backgroundColor: '#8682ff',
    shadowColor: '#8682ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 14,
    elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Web confirm overlay ───────────────────────────────────────────────────
  confirmOverlay: {
    position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100,
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  confirmCard: {
    backgroundColor: '#1e1b2e', borderRadius: 24, padding: 24, width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: 'rgba(134,130,255,0.3)',
    shadowColor: '#8682ff', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24,
  },
  confirmTitle: { color: '#e6e0ec', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  confirmSub:   { color: '#918fa0', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  confirmStats: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  confirmBtns:  { flexDirection: 'row', gap: 12 },
  confirmCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  confirmCancelText: { color: '#918fa0', fontWeight: '600', fontSize: 14 },
  confirmSubmit: {
    flex: 2, paddingVertical: 13, borderRadius: 14,
    backgroundColor: '#8682ff', alignItems: 'center',
    shadowColor: '#8682ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  confirmSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Present Students View ─────────────────────────────────────────────────
  presentHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
  },
  presentLogo:  { width: 48, height: 48, borderRadius: 10 },
  presentTitle: { color: '#e6e0ec', fontSize: 18, fontWeight: '800' },
  presentSub:   { color: '#918fa0', fontSize: 11, marginTop: 2 },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  backBtnText: { color: '#918fa0', fontSize: 12, fontWeight: '700' },

  presentStatRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  presentStat: {
    flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  presentStatNum:   { fontSize: 22, fontWeight: '800' },
  presentStatLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  presentCard: {
    backgroundColor: 'rgba(43,41,50,0.5)',
    borderRadius: 16, marginBottom: 10,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden',
  },
  presentCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  presentAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(74,222,128,0.15)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1,
  },
  presentAvatarText: { color: '#4ADE80', fontSize: 15, fontWeight: '700' },
  presentNameBlock:  { flex: 1 },
  presentName:  { color: '#e6e0ec', fontSize: 15, fontWeight: '600' },
  presentSub2:  { color: '#918fa0', fontSize: 11, marginTop: 2 },
  statusChip: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, marginTop: 6,
  },
  logBtn: {
    backgroundColor: 'rgba(134,130,255,0.15)',
    borderLeftWidth: 1, borderLeftColor: 'rgba(134,130,255,0.2)',
    paddingHorizontal: 16, alignSelf: 'stretch',
    justifyContent: 'center', alignItems: 'center',
  },
  logBtnText: { color: '#8682ff', fontSize: 13, fontWeight: '800', textAlign: 'center' },

  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#918fa0', fontSize: 15, textAlign: 'center' },

  // ── Activity Log Modal ────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:    {
    backgroundColor: '#1d1a23', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40, maxHeight: '85%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { color: '#e6e0ec', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  modalSub:   { color: '#918fa0', fontSize: 14, marginBottom: 20 },
  typeRow:    { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn:    {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  typeBtnActive:     { backgroundColor: 'rgba(134,130,255,0.15)', borderColor: '#8682ff' },
  typeBtnText:       { color: '#918fa0', fontSize: 13, fontWeight: '700' },
  typeBtnTextActive: { color: '#c3c0ff' },

  gathaRow:    {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  gathaRowSel: { backgroundColor: 'rgba(134,130,255,0.05)' },
  check:       { color: '#8682ff', fontSize: 20, marginRight: 12 },
  gathaName:   { flex: 1, color: '#e6e0ec', fontSize: 15, fontWeight: '500' },
  gathaPts:    { color: '#4ADE80', fontWeight: '700', fontSize: 14 },

  input:       {
    backgroundColor: 'rgba(0,0,0,0.3)', color: '#e6e0ec',
    borderRadius: 12, padding: 16, fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  modalFooter:   { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn:     {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
  },
  modalCancelBtnText: { color: '#918fa0', fontWeight: '700', fontSize: 15 },
  modalSubmitBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: '#8682ff',
    alignItems: 'center',
    shadowColor: '#8682ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  modalSubmitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
