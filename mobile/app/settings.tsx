import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '../store';
import { Colors } from '../constants/colors';
import { getDistrictByCode } from '../constants/districts';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, clearAuth } = useStore();

  const district = user?.district_code ? getDistrictByCode(user.district_code) : null;
  const initials = user?.display_name?.[0]?.toUpperCase()
    || user?.phone?.slice(-2)
    || '?';
  const displayName = user?.display_name || user?.phone || 'Demo User';

  async function handleLogout() {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await clearAuth();
            router.replace('/onboarding');
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar + name */}
        <LinearGradient colors={['#C8102E', '#9B0D23']} style={styles.profileGradient}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.displayName}>{displayName}</Text>
            {user?.phone && user.display_name && (
              <Text style={styles.phone}>{user.phone}</Text>
            )}
            {district && (
              <View style={styles.districtBadge}>
                <MaterialCommunityIcons name="map-marker" size={14} color={Colors.primary} />
                <Text style={styles.districtText}>{district.name}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Settings rows */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>

          <SettingsRow
            icon="map-marker-outline"
            label="Change District"
            value={district?.name || 'Not set'}
            onPress={() => router.push('/onboarding')}
          />
          <SettingsRow
            icon="bell-outline"
            label="Notification Preferences"
            value=""
            onPress={() => {}}
          />
          <SettingsRow
            icon="shield-lock-outline"
            label="Privacy Policy"
            value=""
            onPress={() => {}}
          />
          <SettingsRow
            icon="star-outline"
            label="Rate this App"
            value=""
            onPress={() => {}}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>

          <SettingsRow
            icon="information-outline"
            label="Version"
            value="1.0.0"
          />
          <SettingsRow
            icon="flag-outline"
            label="Made for Trinidad & Tobago"
            value=""
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color={Colors.critical} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Built with love for Trinidad & Tobago</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({
  icon, label, value, onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <MaterialCommunityIcons name={icon as any} size={20} color={Colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress && (
        <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  profileGradient: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  displayName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  phone: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  districtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  districtText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 2,
  },
  rowLabel: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  rowValue: { fontSize: 14, color: Colors.textSecondary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.critical,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  logoutText: { color: Colors.critical, fontWeight: '700', fontSize: 15 },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 24,
  },
});
