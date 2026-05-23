import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// ── Placeholder — will be fully implemented in Prompt 3 ──────────────────────
export default function ClassListScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.text}>Class List — Building…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center' },
  text:      { color: '#818cf8', marginTop: 12, fontSize: 15 },
});
