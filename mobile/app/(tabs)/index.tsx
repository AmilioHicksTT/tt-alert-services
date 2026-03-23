import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore } from '../../store';
import { areaApi } from '../../services/api';
import { Colors, AlertTypeColors, AlertTypeIcons, cardShadow } from '../../constants/colors';
import { getDistrictByCode } from '../../constants/districts';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatBubble({ count, label, icon }: { count: number; label: string; icon: string }) {
  return (
    <View style={styles.statBubble}>
      <MaterialCommunityIcons name={icon as any} size={16} color="rgba(255,255,255,0.8)" />
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, location, summary, setSummary, alerts, setAlerts } = useStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const district = user?.district_code ? getDistrictByCode(user.district_code) : null;

  const fetchSummary = useCallback(async () => {
    const params = user?.district_code
      ? { district: user.district_code }
      : location
      ? { lat: location.lat, lng: location.lng }
      : null;
    if (!params) return;
    setError(false);
    try {
      const { data } = await areaApi.summary(params);
      setSummary(data);
      setAlerts(data.alerts);
    } catch (e) {
      console.error('Failed to load summary', e);
      if (!summary) setError(true);
    }
  }, [user?.district_code, location]);

  useEffect(() => {
    setLoading(true);
    fetchSummary().finally(() => setLoading(false));
  }, [fetchSummary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  };

  if (loading && !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your area...</Text>
      </View>
    );
  }

  if (error && !summary) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="wifi-off" size={48} color={Colors.textMuted} />
        <Text style={styles.errorTitle}>Couldn't connect</Text>
        <Text style={styles.errorSub}>The server may be waking up. This usually takes a few seconds.</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); fetchSummary().finally(() => setLoading(false)); }}
        >
          <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const criticalAlerts = (summary?.alerts || alerts).filter((a) => a.severity === 'critical');
  const otherAlerts = (summary?.alerts || alerts).filter((a) => a.severity !== 'critical');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero card */}
        <LinearGradient
          colors={['#C8102E', '#9B0D23']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.heroDistrict}>
                {district?.name || summary?.district?.name || 'Your Area'}
              </Text>
            </View>
            <View style={styles.heroIconCircle}>
              <MaterialCommunityIcons name="shield-check" size={28} color="#fff" />
            </View>
          </View>
          {summary && (
            <View style={styles.statsRow}>
              <StatBubble count={summary.alerts?.length || 0} label="Alerts" icon="bell-alert" />
              <StatBubble count={summary.reports?.length || 0} label="Reports" icon="flag" />
              <StatBubble count={summary.transport_disruptions?.length || 0} label="Transport" icon="bus" />
            </View>
          )}
        </LinearGradient>

        {/* Critical alerts banner */}
        {criticalAlerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={styles.criticalCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/alert/${alert.id}`); }}
          >
            <View style={styles.criticalHeader}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
              <Text style={styles.criticalBadge}>CRITICAL</Text>
            </View>
            <Text style={styles.criticalTitle}>{alert.title}</Text>
            <Text style={styles.criticalBody} numberOfLines={2}>{alert.body}</Text>
          </TouchableOpacity>
        ))}

        {/* No disruptions state */}
        {!criticalAlerts.length && !otherAlerts.length && !summary?.reports?.length && !summary?.transport_disruptions?.length && (
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.allClearCard}
          >
            <View style={styles.allClearIconCircle}>
              <MaterialCommunityIcons name="check-circle" size={36} color="#16A34A" />
            </View>
            <Text style={styles.allClearTitle}>All Clear</Text>
            <Text style={styles.allClearSub}>No active disruptions in your area right now.</Text>
          </LinearGradient>
        )}

        {/* Active alerts */}
        {otherAlerts.length > 0 && (
          <Section title="Active Alerts" icon="bell-alert">
            {otherAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/alert/${alert.id}`); }}
              >
                <View style={[styles.alertTypeBar, { backgroundColor: AlertTypeColors[alert.type] || Colors.info }]} />
                <View style={styles.alertContent}>
                  <View style={styles.alertRow}>
                    <MaterialCommunityIcons
                      name={(AlertTypeIcons[alert.type] || 'information') as any}
                      size={16}
                      color={AlertTypeColors[alert.type] || Colors.info}
                    />
                    <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                  </View>
                  <Text style={styles.alertBody} numberOfLines={2}>{alert.body}</Text>
                  <Text style={styles.alertMeta}>{alert.source} · {timeAgo(alert.created_at)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* Transport disruptions */}
        {summary?.transport_disruptions?.length ? (
          <Section title="Transport" icon="bus-alert">
            {summary.transport_disruptions.map((route) => (
              <View key={route.id} style={styles.transportCard}>
                <View style={[styles.statusDot, { backgroundColor: route.status === 'cancelled' ? Colors.critical : Colors.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.transportName}>{route.name}</Text>
                  <Text style={styles.transportStatus}>
                    {route.status === 'cancelled' ? 'Cancelled' : `Delayed ~${route.delay_mins} min`}
                    {route.status_note ? ` — ${route.status_note}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Citizen reports */}
        {summary?.reports?.length ? (
          <Section title="Community Reports" icon="flag">
            {summary.reports.slice(0, 5).map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <MaterialCommunityIcons name="flag" size={16} color={Colors.textSecondary} />
                <View style={styles.reportContent}>
                  <Text style={styles.reportType}>{formatReportType(report.type)}</Text>
                  {report.description && (
                    <Text style={styles.reportDesc} numberOfLines={1}>{report.description}</Text>
                  )}
                  <Text style={styles.reportMeta}>{report.upvotes} confirms · {timeAgo(report.created_at)}</Text>
                </View>
              </View>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon as any} size={18} color={Colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatReportType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { color: Colors.textSecondary, fontSize: 14, marginTop: 12 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  errorSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 20,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scroll: { padding: 16, paddingBottom: 32 },

  // Hero card
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...cardShadow,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  heroDistrict: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  statCount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Critical
  criticalCard: {
    backgroundColor: Colors.critical,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  criticalHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  criticalBadge: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  criticalTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  criticalBody: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },

  // All clear
  allClearCard: {
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    ...cardShadow,
  },
  allClearIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(22,163,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  allClearTitle: { fontSize: 20, fontWeight: '800', color: '#16A34A', marginTop: 8 },
  allClearSub: { fontSize: 14, color: '#4B7A5A', marginTop: 4, textAlign: 'center' },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Alert cards
  alertCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    ...cardShadow,
  },
  alertTypeBar: { width: 4 },
  alertContent: { flex: 1, padding: 12 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  alertBody: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  alertMeta: { fontSize: 11, color: Colors.textMuted },

  // Transport
  transportCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...cardShadow,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  transportName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  transportStatus: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Reports
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 10,
    ...cardShadow,
  },
  reportContent: { flex: 1 },
  reportType: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  reportDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reportMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
