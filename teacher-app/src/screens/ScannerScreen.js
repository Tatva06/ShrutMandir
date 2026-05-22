import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API_BASE = 'http://localhost:5000/api';

// How long (ms) to lock scanning after a successful read — prevents double-scans
const SCAN_COOLDOWN_MS = 3000;

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [lastScanned, setLastScanned]   = useState(null);
  const cooldownRef = useRef(null);

  // Clean up cooldown timer on unmount
  useEffect(() => () => clearTimeout(cooldownRef.current), []);

  // ── Handle a detected barcode ──
  const handleBarcodeScanned = async ({ data }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);
    setLastScanned(data);

    try {
      // data is expected to be the student's qrId
      // First, find the student matching this qrId
      const searchRes  = await fetch(`${API_BASE}/students`);
      const searchJson = await searchRes.json();

      if (!searchJson.success) throw new Error('Could not fetch students.');

      const student = searchJson.data.find((s) => s.qrId === data);

      if (!student) {
        Alert.alert(
          '❓ Unknown QR Code',
          `No student found for code:\n"${data}"`,
          [{ text: 'Scan Again', onPress: resetScanner }]
        );
        setProcessing(false);
        return;
      }

      // Mark the student as Present
      const attendRes  = await fetch(`${API_BASE}/attendance`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          records: [
            {
              studentId:     student._id,
              status:        'Present',
              pointsAwarded: 10,
              teacherNotes:  'Marked via QR scan',
            },
          ],
        }),
      });
      const attendJson = await attendRes.json();

      if (attendJson.success) {
        Alert.alert(
          '✅ Marked Present',
          `${student.firstName} ${student.lastName} has been marked Present (+10 pts).`,
          [{ text: 'Scan Next', onPress: resetScanner }]
        );
      } else {
        throw new Error(attendJson.message ?? 'Attendance save failed.');
      }
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Something went wrong.', [
        { text: 'Try Again', onPress: resetScanner },
      ]);
    } finally {
      setProcessing(false);
      // Auto-reset scanner after cooldown even if no Alert action taken
      cooldownRef.current = setTimeout(resetScanner, SCAN_COOLDOWN_MS);
    }
  };

  const resetScanner = () => {
    clearTimeout(cooldownRef.current);
    setScanned(false);
    setLastScanned(null);
  };

  // ── Permission states ──
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>📷 Camera Access Needed</Text>
        <Text style={styles.permSubtitle}>
          ShrutMandir needs camera access to scan student QR codes.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Scanner UI ──
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Dark overlay with cut-out reticle */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.overlayTop}>
          <Text style={styles.overlayTitle}>🎵 ShrutMandir</Text>
          <Text style={styles.overlaySubtitle}>Point the camera at a student's QR code</Text>
        </View>

        {/* Reticle row */}
        <View style={styles.reticleRow}>
          <View style={styles.overlayFill} />
          <View style={styles.reticle}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlayFill} />
        </View>

        {/* Bottom info bar */}
        <View style={styles.overlayBottom}>
          {processing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.processingText}>Processing…</Text>
            </View>
          ) : scanned ? (
            <Text style={styles.scannedText}>✅ Scanned: {lastScanned}</Text>
          ) : (
            <Text style={styles.idleText}>Waiting for QR code…</Text>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={resetScanner}>
            <Text style={styles.resetBtnText}>🔄 Reset Scanner</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const RETICLE_SIZE = 240;
const CORNER_SIZE  = 24;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    backgroundColor: '#0f0e17',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  // Permission screen
  permTitle:    { color: '#e0e7ff', fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  permSubtitle: { color: '#818cf8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Overlay
  overlay: { flex: 1 },

  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 60,
  },
  overlayTitle:    { color: '#fff', fontSize: 20, fontWeight: '700' },
  overlaySubtitle: { color: '#c7d2fe', fontSize: 13, marginTop: 6 },

  reticleRow: { flexDirection: 'row', height: RETICLE_SIZE },
  overlayFill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },

  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    backgroundColor: 'transparent',
  },

  // Corner brackets
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#6366f1',
  },
  cornerTL: { top: 0, left: 0,  borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },

  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 30,
  },

  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  processingText: { color: '#fff', fontSize: 15 },
  scannedText:    { color: '#86efac', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  idleText:       { color: '#c7d2fe', fontSize: 14 },

  resetBtn: {
    backgroundColor: 'rgba(99,102,241,0.25)',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  resetBtnText: { color: '#a5b4fc', fontSize: 14, fontWeight: '600' },
});
