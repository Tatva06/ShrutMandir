import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';
import LegalFooter from '../components/LegalFooter';

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
        <View style={styles.pageHeader}>
          <Image
            source={require('../../assets/shrutmandir-logo.png')}
            style={styles.pageLogo}
            resizeMode="contain"
          />
          <Text style={styles.pageTitle}>My Profile</Text>
        </View>

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

        <LegalFooter />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d15' },
  content: { padding: 20, flex: 1 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 10 },
  pageLogo: { width: 44, height: 44, borderRadius: 10 },
  pageTitle: { color: '#e6e0ec', fontSize: 24, fontWeight: '800' },
  
  card: {
    backgroundColor: 'rgba(44,38,77,0.4)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 30,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(44,38,77,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(134,130,255,0.3)',
    shadowColor: '#8682ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  avatarText: { color: '#c3c0ff', fontSize: 32, fontWeight: '800' },
  name: { color: '#e6e0ec', fontSize: 24, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  role: { color: '#8682ff', fontSize: 13, fontWeight: '700', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 1 },
  
  infoRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: { color: '#918fa0', fontSize: 15 },
  infoValue: { color: '#e6e0ec', fontSize: 15, fontWeight: '600' },

  logoutBtn: {
    backgroundColor: 'rgba(251,113,133,0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.3)',
  },
  logoutBtnText: { color: '#FB7185', fontSize: 16, fontWeight: '700' },

  statsContainer: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  statsTitle: { color: '#8682ff', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(44,38,77,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(134,130,255,0.2)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statBoxValue: { color: '#fbbf24', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statBoxLabel: { color: '#c7c4d6', fontSize: 12, fontWeight: '600' },
});
