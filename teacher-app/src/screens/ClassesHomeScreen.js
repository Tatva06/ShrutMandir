import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, StatusBar, RefreshControl,
} from 'react-native';

import { API_BASE } from '../config';
import LegalFooter from '../components/LegalFooter';

const AGE_ORDER = ['5-10', '11-15', '16+', '3-8', '6-15'];

export default function ClassesHomeScreen({ navigation }) {
  const [classes,    setClasses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClasses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/classes`);
      const json = await res.json();
      if (json.success) {
        const sorted = [...json.data].sort(
          (a, b) => {
            const ai = AGE_ORDER.indexOf(a.ageGroup);
            const bi = AGE_ORDER.indexOf(b.ageGroup);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          }
        );
        setClasses(sorted);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8682ff" />
        <Text style={styles.loadingText}>Loading classes…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0d15" />
      <FlatList
        data={classes}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchClasses(true)} tintColor="#8682ff" />
        }
        ListHeaderComponent={
          <Text style={styles.sectionHeader}>Select a Class</Text>
        }
        renderItem={({ item }) => <ClassCard item={item} onPress={() =>
          navigation.navigate('ClassList', { classId: item._id, className: item.className })
        } />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No classes found.</Text>
        }
        ListFooterComponent={
          <LegalFooter />
        }
      />
    </SafeAreaView>
  );
}

function ClassCard({ item, onPress }) {
  const colors = {
    '5-10': '#4ADE80', '11-15': '#FBB040', '16+': '#8682ff',
    '3-8': '#4ADE80', '6-15': '#FBB040',
  };
  const color = colors[item.ageGroup] ?? '#c3c0ff';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <Text style={styles.className}>{item.className}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '55' }]}>
            <Text style={[styles.badgeText, { color }]}>Ages {item.ageGroup}</Text>
          </View>
          <View style={styles.badgeDefault}>
            <Text style={styles.badgeDefaultText}>👥 {item.studentCount ?? 0} Students</Text>
          </View>
          {item.isLockedToday && (
            <View style={styles.badgeDone}>
              <Text style={styles.badgeDoneText}>✅ Done</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0d15' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d15', gap: 12 },
  loadingText: { color: '#918fa0', fontSize: 15 },
  list:        { padding: 20, paddingBottom: 40 },
  sectionHeader: {
    color: '#8682ff', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(43,41,50,0.5)',
    borderRadius: 18, marginBottom: 14, flexDirection: 'row',
    alignItems: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardAccent: { width: 4, alignSelf: 'stretch' },
  cardBody:   { flex: 1, padding: 18 },
  className:  { color: '#e6e0ec', fontSize: 20, fontWeight: '700', marginBottom: 8, letterSpacing: -0.3 },
  badgeRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeDefault: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(134,130,255,0.12)', borderColor: 'rgba(134,130,255,0.3)',
  },
  badgeDefaultText: { color: '#c3c0ff', fontSize: 12, fontWeight: '600' },
  badgeDone: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.35)',
  },
  badgeDoneText: { color: '#4ADE80', fontSize: 12, fontWeight: '700' },
  arrow:      { color: 'rgba(255,255,255,0.2)', fontSize: 28, paddingRight: 18 },
  emptyText:  { color: '#918fa0', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
