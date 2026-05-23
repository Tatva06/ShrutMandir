import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ── Placeholder — will be fully implemented in Prompt 5 ──────────────────────
export default function StudentProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Student Profile — Building…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center' },
  text:      { color: '#818cf8', fontSize: 15 },
});
