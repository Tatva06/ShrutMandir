import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

export default function TeacherProfileScreen({ userData, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const nameParts = (userData?.name || 'Teacher').trim().split(/\s+/);
  const initials = (nameParts[0]?.[0] ?? '') + (nameParts[1]?.[0] ?? '');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;
        const res = await fetch(`${API_BASE}/teachers/my-stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) setStats(json.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  const handleLogoutPress = () => {
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0e17" />
      <View style={styles.content}>
        <Text style={styles.pageTitle}>👤 My Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{userData?.name || 'Teacher'}</Text>
          <Text style={styles.role}>{userData?.role || 'Staff'}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username:</Text>
            <Text style={styles.infoValue}>{userData?.username || '—'}</Text>
          </View>

          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>YOUR ACTIVITY</Text>
            {loadingStats ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 10 }} />
            ) : (
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{stats?.totalSessions || 0}</Text>
                  <Text style={styles.statBoxLabel}>Attendances</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{stats?.totalGathas || 0}</Text>
                  <Text style={styles.statBoxLabel}>Gathas</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress} activeOpacity={0.8}>
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0e17' },
  content: { padding: 20, flex: 1 },
  pageTitle: { color: '#e0e7ff', fontSize: 26, fontWeight: '800', marginBottom: 24, marginTop: 10 },
  
  card: {
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#312e81',
    marginBottom: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4338ca',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#e0e7ff', fontSize: 28, fontWeight: '700' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  role: { color: '#818cf8', fontSize: 14, fontWeight: '600', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 1 },
  
  infoRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#312e81',
  },
  infoLabel: { color: '#a5b4fc', fontSize: 15 },
  infoValue: { color: '#e0e7ff', fontSize: 15, fontWeight: '600' },

  logoutBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  statsContainer: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#312e81',
  },
  statsTitle: { color: '#6366f1', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#4338ca',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statBoxValue: { color: '#e0e7ff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statBoxLabel: { color: '#818cf8', fontSize: 12, fontWeight: '600' },
});
