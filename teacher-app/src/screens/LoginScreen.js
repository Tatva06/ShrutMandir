import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';
import LegalFooter from '../components/LegalFooter';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || 'Invalid credentials.');
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem('userToken', json.token);
      await AsyncStorage.setItem('userData', JSON.stringify(json.user));
      setLoading(false);
      if (onLoginSuccess) onLoginSuccess();
    } catch {
      setError('Network error. Please check your connection.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0f0d15" />

      {/* Background glow orbs */}
      <View style={styles.glowOrb1} />
      <View style={styles.glowOrb2} />

      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🎵</Text>
          </View>
          <Text style={styles.logoText}>ShrutMandir</Text>
          <Text style={styles.logoSub}>TEACHER PORTAL</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠  {error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor="#4c4f6b"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#4c4f6b"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Sign In →</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
      
      <LegalFooter />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0f0d15',
    justifyContent: 'center', alignItems: 'center', padding: 24,
    overflow: 'hidden',
  },

  // Background glow orbs (decorative)
  glowOrb1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(134,130,255,0.07)', top: -80, left: -80,
  },
  glowOrb2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(74,222,128,0.04)', bottom: -40, right: -40,
  },

  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: 'rgba(43,41,50,0.55)',
    borderRadius: 28, padding: 36,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(134,130,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(134,130,255,0.35)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  logoEmoji: { fontSize: 32 },
  logoText: {
    fontSize: 26, fontWeight: '800', color: '#e6e0ec',
    letterSpacing: -0.5, marginBottom: 4,
  },
  logoSub: {
    fontSize: 11, fontWeight: '700', color: '#918fa0',
    textTransform: 'uppercase', letterSpacing: 2,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(251,113,133,0.1)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(251,113,133,0.25)', marginBottom: 20,
  },
  errorText: { color: '#FB7185', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  form: { gap: 18 },
  field: { gap: 8 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#8682ff',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(15,13,21,0.8)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    color: '#e6e0ec', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
  },
  btn: {
    backgroundColor: '#8682ff',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#8682ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
