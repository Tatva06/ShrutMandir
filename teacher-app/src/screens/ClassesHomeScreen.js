import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, StatusBar, RefreshControl, Alert,
} from 'react-native';

const API_BASE = 'https://shrut-mandir.vercel.app/api';

// Age-group sort order (youngest first)
const AGE_ORDER = ['5-10', '11-15', '16+'];

export default function ClassesHomeScreen({ navigation }) {
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClasses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/classes`);
      const json = await res.json();
      if (json.success) {
        // Sort by our predefined age-group order
        const sorted = [...json.data].sort(
          (a, b) => AGE_ORDER.indexOf(a.ageGroup) - AGE_ORDER.indexOf(b.ageGroup)
        );
        setClasses(sorted);
      } else {
        Alert.alert('Error', 'Could not load classes.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not reach the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const ageGroupLabel = (group) => {
    const map = { '5-10': 'Ages 5–10', '11-15': 'Ages 11–15', '16+': 'Ages 16+' };
    return map[group] ?? `Ages ${group}`;
  };

  const ageGroupColor = (group) => {
    const map = { '5-10': '#22c55e', '11-15': '#f59e0b', '16+': '#818cf8' };
    return map[group] ?? '#6366f1';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading classes…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0e17" />

      <FlatList
        data={classes}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchClasses(true)}
            tintColor="#6366f1"
          />
        }
        ListHeaderComponent={
          <Text style={styles.sectionHeader}>Select a Class</Text>
        }
        renderItem={({ item }) => {
          const color = ageGroupColor(item.ageGroup);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() =>
                navigation.navigate('ClassList', {
                  classId:   item._id,
                  className: item.className,
                })
              }
            >
              {/* Left accent bar */}
              <View style={[styles.cardAccent, { backgroundColor: color }]} />

              <View style={styles.cardBody}>
                <Text style={styles.className}>{item.className}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.ageBadge, { backgroundColor: color + '22', borderColor: color }]}>
                    <Text style={[styles.ageBadgeText, { color }]}>{ageGroupLabel(item.ageGroup)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No classes found.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0e17' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0e17' },
  loadingText: { marginTop: 12, color: '#a5b4fc', fontSize: 15 },

  list:          { padding: 20, paddingBottom: 40 },
  sectionHeader: { color: '#6366f1', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 },

  card: {
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#312e81',
  },
  cardAccent: { width: 5, alignSelf: 'stretch' },
  cardBody:   { flex: 1, padding: 18 },
  className:  { color: '#e0e7ff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  badgeRow:   { flexDirection: 'row', gap: 8 },
  ageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  ageBadgeText: { fontSize: 12, fontWeight: '600' },
  arrow: { color: '#4c4f6b', fontSize: 28, paddingRight: 16 },
  emptyText: { color: '#4c4f6b', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
