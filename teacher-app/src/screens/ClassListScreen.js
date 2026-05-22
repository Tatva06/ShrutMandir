import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';

const API_BASE = Platform.OS === 'web'
  ? 'http://localhost:5000/api'
  : 'http://10.100.58.122:5000/api';

// Per-student status options a teacher can toggle
const STATUSES = ['Present', 'Absent', 'Late'];

const STATUS_COLORS = {
  Present: { active: '#22c55e', label: '#fff' },
  Absent:  { active: '#ef4444', label: '#fff' },
  Late:    { active: '#f59e0b', label: '#fff' },
};

// ─── Sub-component: single student row ────────────────────────────────────────
function StudentRow({ student, status, onStatusChange }) {
  const fullName = `${student.firstName} ${student.lastName}`;
  const groupName = student.classGroupId?.name ?? '—';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.studentName}>{fullName}</Text>
          <Text style={styles.groupLabel}>{groupName}</Text>
        </View>
        <Text style={styles.pointsBadge}>⭐ {student.totalPoints}</Text>
      </View>

      <View style={styles.toggleRow}>
        {STATUSES.map((s) => {
          const isActive = status === s;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.toggleBtn,
                isActive && { backgroundColor: STATUS_COLORS[s].active },
              ]}
              onPress={() => onStatusChange(student._id, s)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  isActive && { color: STATUS_COLORS[s].label },
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ClassListScreen() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Map of studentId → 'Present' | 'Absent' | 'Late' | null
  const [statusMap, setStatusMap] = useState({});

  // ── Fetch students ──
  const fetchStudents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res  = await fetch(`${API_BASE}/students`);
      const json = await res.json();
      if (json.success) {
        setStudents(json.data);
        // Initialise all statuses to null (not yet marked)
        const initial = {};
        json.data.forEach((s) => (initial[s._id] = null));
        setStatusMap(initial);
      } else {
        Alert.alert('Error', 'Could not load students.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Make sure the backend is running on localhost:5000.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // ── Toggle handler ──
  const handleStatusChange = (studentId, newStatus) => {
    setStatusMap((prev) => ({
      ...prev,
      // Tapping the active status again deselects it
      [studentId]: prev[studentId] === newStatus ? null : newStatus,
    }));
  };

  // ── Submit attendance ──
  const handleSubmit = async () => {
    const records = students
      .filter((s) => statusMap[s._id] !== null)
      .map((s) => ({
        studentId:     s._id,
        status:        statusMap[s._id],
        pointsAwarded: statusMap[s._id] === 'Present' ? 10
                     : statusMap[s._id] === 'Late'    ? 5
                     : 0,
      }));

    if (records.length === 0) {
      Alert.alert('Nothing to submit', 'Please mark at least one student before submitting.');
      return;
    }

    const unmarked = students.length - records.length;
    if (unmarked > 0) {
      Alert.alert(
        'Unmarked students',
        `${unmarked} student(s) have not been marked. Submit anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: () => submitRecords(records) },
        ]
      );
    } else {
      submitRecords(records);
    }
  };

  const submitRecords = async (records) => {
    setSubmitting(true);
    try {
      const res  = await fetch(`${API_BASE}/attendance`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ records }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert('✅ Submitted', `${json.count} attendance record(s) saved successfully.`);
        fetchStudents(); // reset the list
      } else {
        Alert.alert('Error', json.message ?? 'Submission failed.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Could not reach the backend.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  const markedCount = Object.values(statusMap).filter(Boolean).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading students…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Class Attendance</Text>
        <Text style={styles.headerSubtitle}>
          {markedCount} / {students.length} marked
        </Text>
      </View>

      {/* ── Student List ── */}
      <FlatList
        data={students}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchStudents(true)}
            tintColor="#6366f1"
          />
        }
        renderItem={({ item }) => (
          <StudentRow
            student={item}
            status={statusMap[item._id]}
            onStatusChange={handleStatusChange}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No students found in this class.</Text>
        }
      />

      {/* ── Submit Button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Attendance</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f0e17' },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0e17' },
  loadingText:{ marginTop: 12, color: '#a5b4fc', fontSize: 15 },

  header: {
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#312e81',
  },
  headerTitle:    { color: '#e0e7ff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#818cf8', fontSize: 13, marginTop: 2 },

  list: { padding: 16, paddingBottom: 100 },

  card: {
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentName:  { color: '#e0e7ff', fontSize: 16, fontWeight: '600' },
  groupLabel:   { color: '#818cf8', fontSize: 12, marginTop: 2 },
  pointsBadge:  { color: '#fbbf24', fontSize: 13, fontWeight: '600' },

  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4338ca',
    alignItems: 'center',
  },
  toggleBtnText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#0f0e17',
    borderTopWidth: 1,
    borderTopColor: '#1e1b4b',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  emptyText: { color: '#4c4f6b', textAlign: 'center', marginTop: 40 },
});
