import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet,
  SafeAreaView, StatusBar, RefreshControl, TouchableOpacity, Alert, ScrollView
} from 'react-native';

import { API_BASE } from '../config';
import LegalFooter from '../components/LegalFooter';

// Returns today as 'YYYY-MM-DD' in local time
function todayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function DashboardScreen() {
  const [students, setStudents]   = useState([]);
  const [classes, setClasses]     = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [stuRes, clsRes] = await Promise.all([
        fetch(`${API_BASE}/students`),
        fetch(`${API_BASE}/classes`)
      ]);
      const stuJson = await stuRes.json();
      const clsJson = await clsRes.json();
      
      if (stuJson.success) setStudents(stuJson.data);
      if (clsJson.success) setClasses(clsJson.data);
    } catch {
      Alert.alert('Network Error', 'Could not reach the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = todayString();

  // ── Derived statistics ─────────────────────────────────────────────────────
  const filteredStudents = selectedClass === 'all' 
    ? students 
    : students.filter(s => s.classId && s.classId._id === selectedClass);

  const totalStudents = filteredStudents.length;

  const presentToday = filteredStudents.filter(s =>
    (s.attendanceLogs || []).some(l => l.date === today && l.status === 'Present')
  ).length;

  const lateToday = filteredStudents.filter(s =>
    (s.attendanceLogs || []).some(l => l.date === today && l.status === 'Late')
  ).length;

  const gathasToday = filteredStudents.reduce((acc, s) =>
    acc + (s.activityLogs || []).filter(l => l.date === today && l.type === 'Gatha').length,
    0
  );

  // Leaderboard — sorted descending by points
  const leaderboard = [...filteredStudents].sort((a, b) => (b.points || 0) - (a.points || 0));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0e17" />

      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#6366f1" />
        }
        ListHeaderComponent={
          <>
            {/* ── Page Title ── */}
            <Text style={styles.pageTitle}>📊 Dashboard</Text>
            <Text style={styles.dateLabel}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>

            {/* ── Today's Stats ── */}
            <Text style={styles.sectionLabel}>TODAY'S SUMMARY</Text>
            <View style={styles.statsGrid}>
              <StatCard icon="👥" value={totalStudents}  label="Total Students" color="#818cf8" />
              <StatCard icon="✅" value={presentToday}   label="Present Today"  color="#22c55e" />
              <StatCard icon="🕐" value={lateToday}      label="Late Today"     color="#f59e0b" />
              <StatCard icon="🙏" value={gathasToday}    label="Gathas Today"   color="#f472b6" />
            </View>

            {/* ── Filter Bar ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
              <TouchableOpacity
                style={[styles.filterChip, selectedClass === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedClass('all')}
              >
                <Text style={[styles.filterChipText, selectedClass === 'all' && styles.filterChipTextActive]}>All Classes</Text>
              </TouchableOpacity>
              {classes.map(c => (
                <TouchableOpacity
                  key={c._id}
                  style={[styles.filterChip, selectedClass === c._id && styles.filterChipActive]}
                  onPress={() => setSelectedClass(c._id)}
                >
                  <Text style={[styles.filterChipText, selectedClass === c._id && styles.filterChipTextActive]}>{c.className}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Leaderboard Header ── */}
            <Text style={styles.sectionLabel}>LEADERBOARD — TOP STUDENTS</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <LeaderboardRow student={item} rank={index + 1} />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No students found.</Text>
        ListFooterComponent={
          <LegalFooter />
        }
      />
    </SafeAreaView>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '55' }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Leaderboard Row ──────────────────────────────────────────────────────────
function LeaderboardRow({ student, rank }) {
  const medalColor = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#4c4f6b';
  const nameParts  = (student.name || '').trim().split(/\s+/);
  const initials   = (nameParts[0]?.[0] ?? '') + (nameParts[1]?.[0] ?? '');

  return (
    <View style={styles.leaderRow}>
      <Text style={[styles.rank, { color: medalColor }]}>
        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
      </Text>
      <View style={[styles.avatar, { backgroundColor: '#312e81' }]}>
        <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
      </View>
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderName}>{student.name}</Text>
        <Text style={styles.leaderVillage}>{student.village || '—'}</Text>
      </View>
      <View style={styles.pointsBadge}>
        <Text style={styles.pointsValue}>⭐ {student.points || 0}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0d15' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d15' },
  loadingText: { marginTop: 12, color: '#c3c0ff', fontSize: 15 },

  list:        { padding: 20, paddingBottom: 40 },
  pageTitle:   { color: '#e6e0ec', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  dateLabel:   { color: '#8682ff', fontSize: 13, marginBottom: 20 },
  sectionLabel:{ color: '#8682ff', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },

  // Filters
  filterScroll: { marginBottom: 20 },
  filterContent: { gap: 10, paddingRight: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterChipActive: { backgroundColor: 'rgba(134,130,255,0.15)', borderColor: '#8682ff' },
  filterChipText: { color: '#918fa0', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#c3c0ff' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard:  {
    width: '47%',
    backgroundColor: 'rgba(44,38,77,0.4)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIcon:  { fontSize: 26, marginBottom: 6 },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { color: '#c7c4d6', fontSize: 12, marginTop: 2, textAlign: 'center', fontWeight: '600' },

  // Leaderboard
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(44,38,77,0.4)',
    borderRadius: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  rank:      { fontSize: 16, width: 36, textAlign: 'center', fontWeight: '700' },
  avatar:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText:{ color: '#c3c0ff', fontSize: 14, fontWeight: '800' },
  leaderInfo:{ flex: 1 },
  leaderName:{ color: '#e6e0ec', fontSize: 15, fontWeight: '600' },
  leaderVillage: { color: '#8682ff', fontSize: 11, marginTop: 2 },
  pointsBadge:   { backgroundColor: 'rgba(44,38,77,0.8)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  pointsValue:   { color: '#fbbf24', fontSize: 13, fontWeight: '800' },

  emptyText: { color: '#918fa0', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
