import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native';

export default function LegalFooter() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.footerContainer}>
      <Text style={styles.copyrightText}>© 2026 Shrut Mandir. All Rights Reserved.</Text>
      <Text style={styles.creditText}>Designed & Developed by Tatvam Studios</Text>
      
      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.linkContainer}>
        <Text style={styles.linkText}>Terms & Conditions</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms & Conditions</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.modalBody}>
              **Authorized Use Only**{'\n'}
              This application is strictly for the authorized staff and teachers of Shrut Mandir. Unauthorized access, distribution, or sharing of credentials is strictly prohibited.{'\n\n'}
              
              **Data Privacy & Confidentiality**{'\n'}
              This platform contains sensitive student information, including names, contact details, and performance metrics. By using this application, you agree to maintain strict confidentiality and not share any student data outside of authorized educational purposes.{'\n\n'}
              
              **Intellectual Property**{'\n'}
              All designs, code, and systems associated with this platform are the intellectual property of Tatvam Studios and Shrut Mandir. Reverse engineering, copying, or unauthorized modification is forbidden.{'\n\n'}
              
              **Usage Monitoring**{'\n'}
              Activity on this platform is logged for security and administrative purposes. Abuse of the system, including fraudulent attendance logging or point manipulation, may result in access revocation.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: 20,
    width: '100%',
  },
  copyrightText: {
    color: '#918fa0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  creditText: {
    color: '#8682ff',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  linkContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  linkText: {
    color: '#c3c0ff',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f0d15',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#e6e0ec',
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#e6e0ec',
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
    padding: 20,
  },
  modalBody: {
    color: '#c7c4d6',
    fontSize: 15,
    lineHeight: 24,
  },
});
