import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, StatusBar, RefreshControl, Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE } from '../config';

function todayString() {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_CONFIG = {
  Present: { color: '#22c55e', icon: '✅', pts: '+10 pts' },
  Absent:  { color: '#ef4444', icon: '❌', pts: '0 pts'   },
  Late:    { color: '#f59e0b', icon: '🕐', pts: '+5 pts'  },
};

export default function ClassListScreen({ route, navigation }) {
  const { classId, className } = route.params;

  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isLocked,    setIsLocked]    = useState(false);
  const [lockChecked, setLockChecked] = useState(false);

  // Attendance mode state
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [statusMap,      setStatusMap]      = useState({});   // { [studentId]: 'Present'|'Absent'|'Late' }
  const [submitting,     setSubmitting]     = useState(false);

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
        // Filter students to only show those in this specific class
        const classStudents = studJson.data.filter(s =>
          s.classId === classId || (s.classId && s.classId._id === classId)
        );
        setStudents(classStudents);
        // Only reset statusMap on initial load, NOT on refresh after submit
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
      Alert.alert('Network Error', 'Could not reach the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const todayLog = (student) =>
    (student.attendanceLogs || []).find(l => l.date === today);

  const presentCount = Object.values(statusMap).filter(v => v === 'Present').length;

  // ── Toggle attendance status ───────────────────────────────────────────────
  const toggleStatus = (studentId, status) => {
    setStatusMap(prev => ({ ...prev, [studentId]: status }));
  };

  // ── Submit attendance ──────────────────────────────────────────────────────
  const handleSubmit = () => {
    Alert.alert(
      'Submit Attendance',
      `Submit attendance for all ${students.length} students?\n\n✅ Present: ${presentCount}\n❌ Absent: ${Object.values(statusMap).filter(v => v === 'Absent').length}\n🕐 Late: ${Object.values(statusMap).filter(v => v === 'Late').length}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: submitAttendance },
      ]
    );
  };

  const submitAttendance = async () => {
    setSubmitting(true);
    try {
      // Get teacher name from AsyncStorage
      const userDataStr = await AsyncStorage.getItem('userData');
      const teacherName = userDataStr ? JSON.parse(userDataStr).name : 'Unknown Teacher';

      // Prepare bulk data payload
      const attendanceData = students.map(s => ({
        studentId: s._id,
        status: statusMap[s._id]
      }));

      // Fire a single bulk request
      const bulkRes = await fetch(`${API_BASE}/classes/${classId}/bulk-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, loggedBy: teacherName, attendanceData }),
      });

      if (!bulkRes.ok) {
        let errMessage = 'Bulk API failed';
        try {
          const errJson = await bulkRes.json();
          if (errJson.message) errMessage = errJson.message;
        } catch (e) {}
        throw new Error(errMessage);
      }

      // Lock attendance for this class/date
      await fetch(`${API_BASE}/classes/${classId}/lock-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      });

      // ── Optimistic UI update ──────────────────────────────────────────────
      // Immediately inject attendanceLogs into the local students state so
      // status badges appear right away without waiting for a cache-busted refetch.
      const pointsMap = { Present: 10, Late: 5, Absent: 0 };
      setStudents(prev => prev.map(s => {
        const status = statusMap[s._id] || 'Absent';
        const pointsAwarded = pointsMap[status] ?? 0;
        const existingLog = (s.attendanceLogs || []).find(l => l.date === today);
        if (existingLog) return s; // already has a log, don't double-add
        return {
          ...s,
          attendanceLogs: [
            ...(s.attendanceLogs || []),
            { date: today, status, pointsAwarded, timestamp: new Date().toISOString(), loggedBy: teacherName }
          ],
        };
      }));

      setAttendanceMode(false);
      setIsLocked(true);

      Alert.alert('✅ Done!', 'Attendance submitted and locked for today.');

      // Background cache-busted refetch to sync real server data
      fetch(`${API_BASE}/students?t=${Date.now()}`)
        .then(r => r.json())
        .then(json => {
          if (json.success) {
            const classStudents = json.data.filter(s =>
              s.classId === classId || (s.classId && s.classId._id === classId)
            );
            setStudents(classStudents);
          }
        })
        .catch(() => {}); // silent — optimistic data is already showing

    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.message || 'Could not submit attendance. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading students…</Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0e17" />

      <FlatList
        data={students}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#6366f1" />
        }
        ListHeaderComponent={
          <>
            {/* ── Attendance Status Banner ── */}
            {lockChecked && (
              <View style={[styles.lockBanner, isLocked ? styles.lockBannerLocked : styles.lockBannerOpen]}>
                <Text style={styles.lockBannerText}>
                  {isLocked
                    ? '🔒 Attendance locked for today'
                    : '🔓 Attendance not yet taken today'}
                </Text>
              </View>
            )}

            {/* ── Take Attendance Button (only if unlocked & not in mode) ── */}
            {!isLocked && !attendanceMode && (
              <TouchableOpacity
                style={styles.takeAttendanceBtn}
                onPress={() => setAttendanceMode(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.takeAttendanceBtnText}>📋  Take Attendance</Text>
              </TouchableOpacity>
            )}

            {/* ── Cancel Button (while in attendance mode) ── */}
            {attendanceMode && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAttendanceMode(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>✕  Cancel</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.countLabel}>{students.length} Students</Text>
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
          attendanceMode ? (
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  Submit Attendance  ·  {presentCount} Present
                </Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({ student, attendanceMode, isLocked, status, todayLog, onStatusChange, onTap }) {
  const nameParts = (student.name || '').trim().split(/\s+/);
  const initials  = (nameParts[0]?.[0] ?? '') + (nameParts[1]?.[0] ?? '');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onTap}
      activeOpacity={attendanceMode ? 1 : 0.75}
    >
      {/* Avatar + Name */}
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentSub}>Roll {student.rollNo}  ·  {student.village || '—'}</Text>
        </View>
      </View>

      {/* Points badge (read-only) */}
      <Text style={styles.pointsBadge}>⭐ {student.points || 0}</Text>

      {/* ── Attendance mode: radio pills ── */}
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
                <Text style={[styles.pillText, active && { color: '#fff' }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Locked mode: today's status badge ── */}
      {isLocked && !attendanceMode && todayLog && (
        <View style={[styles.statusBadge, { backgroundColor: STATUS_CONFIG[todayLog.status]?.color + '22', borderColor: STATUS_CONFIG[todayLog.status]?.color }]}>
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
  container:   { flex: 1, backgroundColor: '#0f0e17' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0e17' },
  loadingText: { marginTop: 12, color: '#a5b4fc', fontSize: 15 },
  list:        { padding: 16, paddingBottom: 100 },
  countLabel:  { color: '#4c4f6b', fontSize: 12, marginBottom: 10, marginTop: 4 },

  lockBanner: {
    borderRadius: 10, padding: 10, marginBottom: 14,
    borderWidth: 1, alignItems: 'center',
  },
  lockBannerLocked: { backgroundColor: '#ef444422', borderColor: '#ef4444' },
  lockBannerOpen:   { backgroundColor: '#22c55e22', borderColor: '#22c55e' },
  lockBannerText:   { fontWeight: '600', color: '#e0e7ff', fontSize: 13 },

  takeAttendanceBtn: {
    backgroundColor: '#6366f1', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 14,
  },
  takeAttendanceBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  cancelBtn: {
    backgroundColor: '#1e1b4b', borderRadius: 12, borderWidth: 1,
    borderColor: '#4c4f6b', paddingVertical: 10, alignItems: 'center', marginBottom: 14,
  },
  cancelBtnText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: '#1e1b4b', borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#312e81',
  },
  cardLeft:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#312e81', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText:  { color: '#a5b4fc', fontSize: 15, fontWeight: '700' },
  nameBlock:   { flex: 1 },
  studentName: { color: '#e0e7ff', fontSize: 15, fontWeight: '600' },
  studentSub:  { color: '#818cf8', fontSize: 11, marginTop: 2 },
  pointsBadge: { color: '#fbbf24', fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 4 },

  radioRow:  { flexDirection: 'row', gap: 8, marginTop: 4 },
  pill: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#4338ca', alignItems: 'center',
  },
  pillText:  { color: '#818cf8', fontSize: 12, fontWeight: '700' },

  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, marginTop: 4,
  },

  submitBtn: {
    backgroundColor: '#6366f1', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', margin: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
