import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore } from '../store';
import { authApi, DEMO_MODE } from '../services/api';
import { Colors } from '../constants/colors';
import { DISTRICTS } from '../constants/districts';

type Step = 'phone' | 'otp' | 'district';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();

  const formattedPhone = phone.startsWith('+1868') ? phone : `+1868${phone.replace(/\D/g, '')}`;

  async function handleSendOtp() {
    if (phone.replace(/\D/g, '').length < 7) {
      return Alert.alert('Invalid number', 'Enter your 7-digit local number.');
    }
    setLoading(true);
    try {
      await authApi.sendOtp(formattedPhone);
      setStep('otp');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Could not send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) return Alert.alert('Invalid code', 'Enter the 6-digit code from SMS.');
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(formattedPhone, otp);
      await setAuth(data.user, data.token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!data.user.district_code) {
        setStep('district');
      } else {
        router.replace('/');
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectDistrict(code: string) {
    setLoading(true);
    try {
      await authApi.updateProfile({ district_code: code });
      const stored = useStore.getState();
      if (stored.user) await stored.setAuth({ ...stored.user, district_code: code }, stored.token!);
    } catch {}
    setLoading(false);
    router.replace('/');
  }

  return (
    <LinearGradient colors={['#C8102E', '#8B0000']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.flag}>🇹🇹</Text>
          <Text style={styles.title}>T&T Alert + Services</Text>
          <Text style={styles.subtitle}>Your national civic utility app</Text>
        </View>

        {step === 'phone' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter your phone number</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+1868</Text>
              <TextInput
                style={styles.input}
                placeholder="XXX-XXXX"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
            </TouchableOpacity>
          </View>
        )}

        {step === 'otp' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter verification code</Text>
            {DEMO_MODE ? (
              <View style={styles.demoBanner}>
                <Text style={styles.demoText}>
                  DEMO MODE — No SMS is sent. Enter any 6 digits (e.g. 123456) to continue.
                </Text>
                <TouchableOpacity onPress={() => setOtp('123456')}>
                  <Text style={styles.demoFill}>Tap to fill 123456</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.cardSub}>Sent to {formattedPhone}</Text>
            )}
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')} style={styles.link}>
              <Text style={styles.linkText}>Change number</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'district' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Select your area</Text>
            <Text style={styles.cardSub}>Get alerts relevant to where you are</Text>
            {DISTRICTS.map((d) => (
              <TouchableOpacity key={d.code} style={styles.districtRow} onPress={() => handleSelectDistrict(d.code)}>
                <Text style={styles.districtName}>{d.name}</Text>
                <Text style={styles.districtRegion}>{d.region}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  flag: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxHeight: '70%',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  cardSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  prefix: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginRight: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 16, color: Colors.textPrimary,
  },
  demoBanner: {
    backgroundColor: '#FEF9C3', borderRadius: 8, padding: 10, marginBottom: 12,
  },
  demoText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  demoFill: { fontSize: 12, color: Colors.primary, fontWeight: '700', marginTop: 6 },
  otpInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 12,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: Colors.primary, borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { alignItems: 'center', marginTop: 12 },
  linkText: { color: Colors.primary, fontSize: 14 },
  districtRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  districtName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  districtRegion: { fontSize: 12, color: Colors.textSecondary },
});
