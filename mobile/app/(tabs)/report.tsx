import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../../store';
import { reportsApi } from '../../services/api';
import { getCurrentLocation } from '../../services/location';
import { Colors, ReportTypeIcons } from '../../constants/colors';

const REPORT_TYPES = [
  { key: 'water_outage',  label: 'Water Outage',    icon: 'water-off' },
  { key: 'burst_main',    label: 'Burst Main',       icon: 'pipe-leak' },
  { key: 'power_outage',  label: 'Power Outage',     icon: 'flash-off' },
  { key: 'blocked_drain', label: 'Blocked Drain',    icon: 'pipe' },
  { key: 'fallen_tree',   label: 'Fallen Tree',      icon: 'tree' },
  { key: 'flooding',      label: 'Flooding',         icon: 'water' },
  { key: 'road_damage',   label: 'Road Damage',      icon: 'road' },
  { key: 'other',         label: 'Other',            icon: 'flag' },
];

export default function ReportScreen() {
  const { location, user } = useStore();
  const [type, setType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function submit() {
    if (!type) return Alert.alert('Select a type', 'Choose what you are reporting.');

    let coords = location;
    if (!coords) {
      coords = await getCurrentLocation();
      if (!coords) {
        return Alert.alert('Location required', 'Enable location access to submit a report.');
      }
    }

    setSubmitting(true);
    try {
      // In production, upload photo to a CDN/S3 first, then include the URL
      await reportsApi.create({
        type,
        description: description.trim() || undefined,
        lat: coords.lat,
        lng: coords.lng,
        district_code: user?.district_code,
      });

      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setType(null);
      setDescription('');
      setPhotoUri(null);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Could not submit report. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.successContainer}>
        <MaterialCommunityIcons name="check-circle" size={64} color="#16A34A" />
        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successSub}>
          Thank you. Your report helps keep the community informed.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>What are you reporting?</Text>
        <Text style={styles.sub}>Your location is used to pin the report on the map.</Text>

        {/* Type grid */}
        <View style={styles.typeGrid}>
          {REPORT_TYPES.map((rt) => (
            <TouchableOpacity
              key={rt.key}
              style={[styles.typeBtn, type === rt.key && styles.typeBtnActive]}
              onPress={() => setType(rt.key)}
            >
              <MaterialCommunityIcons
                name={rt.icon as any}
                size={24}
                color={type === rt.key ? '#fff' : Colors.textSecondary}
              />
              <Text style={[styles.typeLabel, type === rt.key && styles.typeLabelActive]}>
                {rt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.fieldLabel}>Description (optional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Add more detail to help others..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={500}
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>

        {/* Photo */}
        <Text style={styles.fieldLabel}>Photo (optional)</Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <MaterialCommunityIcons name="camera" size={22} color={Colors.primary} />
            <Text style={styles.photoBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
            <MaterialCommunityIcons name="image" size={22} color={Colors.primary} />
            <Text style={styles.photoBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
        {photoUri && (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotoUri(null)}>
              <MaterialCommunityIcons name="close-circle" size={24} color={Colors.critical} />
            </TouchableOpacity>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !type && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!type || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="flag-plus" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Reports are visible to all users in your area. False reports may be removed.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  typeBtn: {
    width: '47%', backgroundColor: Colors.surface, borderRadius: 10, padding: 14,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  typeLabelActive: { color: '#fff' },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  textArea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12,
    fontSize: 14, color: Colors.textPrimary, textAlignVertical: 'top', minHeight: 100,
    backgroundColor: Colors.surface,
  },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 20 },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 10, padding: 12,
    backgroundColor: Colors.surface,
  },
  photoBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  photoPreviewContainer: { position: 'relative', marginBottom: 20 },
  photoPreview: { width: '100%', height: 180, borderRadius: 10 },
  removePhoto: { position: 'absolute', top: 8, right: 8 },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disclaimer: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 16 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.background },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 16 },
  successSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});
