import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, StatusBar, RefreshControl, Platform,
  ScrollView,
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
  // Web-compatible confirm dialog state
  const [showConfirm,    setShowConfirm]    = useState(false);

  const today = todayString();

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
        // Sort by roll number
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

  const toggleStatus = (studentId, status) => {
    setStatusMap(prev => ({ ...prev, [studentId]: status }));
  };

  // ── Submit attendance ──────────────────────────────────────────────────────
  // FIX: Alert.alert callbacks don't fire in browsers — use custom confirm UI
  const handleSubmit = () => {
    if (Platform.OS === 'web') {
      setShowConfirm(true); // show our own confirm overlay
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
      const teacherName = userDataStr ? JSON.parse(userDataStr).name : 'Unknown Teacher';
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
        body: JSON.stringify({ date: today, loggedBy: teacherName, attendanceData }),
      });

      if (!bulkRes.ok) {
        let errMsg = 'Server error';
        try { const e = await bulkRes.json(); errMsg = e.message || errMsg; } catch {}
        throw new Error(errMsg);
      }

      // Lock attendance
      await fetch(`${API_BASE}/classes/${classId}/lock-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ date: today }),
      });

      // Optimistic UI
      const pointsMap = { Present: 10, Late: 5, Absent: 0 };
      setStudents(prev => prev.map(s => {
        const status = statusMap[s._id] || 'Absent';
        const existingLog = (s.attendanceLogs || []).find(l => l.date === today);
        if (existingLog) return s;
        return {
          ...s,
          attendanceLogs: [
            ...(s.attendanceLogs || []),
            { date: today, status, pointsAwarded: pointsMap[status] ?? 0, timestamp: new Date().toISOString(), loggedBy: teacherName },
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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8682ff" />
        <Text style={styles.loadingText}>Loading students…</Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
            {/* ── Lock status banner ── */}
            {lockChecked && (
              <View style={[styles.lockBanner, isLocked ? styles.lockBannerLocked : styles.lockBannerOpen]}>
                <Text style={styles.lockBannerText}>
                  {isLocked ? '🔒 Attendance locked for today' : '🔓 Attendance open — not yet submitted'}
                </Text>
              </View>
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

  // Lock banner
  lockBanner: { borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, alignItems: 'center' },
  lockBannerLocked: { backgroundColor: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.3)' },
  lockBannerOpen:   { backgroundColor: 'rgba(74,222,128,0.08)',  borderColor: 'rgba(74,222,128,0.3)'  },
  lockBannerText:   { fontWeight: '600', color: '#c7c4d6', fontSize: 13 },

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
});
