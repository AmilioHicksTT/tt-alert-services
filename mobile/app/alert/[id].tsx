import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';
import { alertsApi } from '../../services/api';
import { Colors, AlertTypeColors, AlertTypeIcons } from '../../constants/colors';

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [alert, setAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alertsApi.get(id).then(({ data }) => setAlert(data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  if (!alert) {
    return <View style={styles.center}><Text style={styles.notFound}>Alert not found</Text></View>;
  }

  const color = AlertTypeColors[alert.type] || Colors.info;
  const iconName = (AlertTypeIcons[alert.type] || 'information') as any;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Severity banner */}
      <View style={[styles.severityBanner, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={iconName} size={28} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.severityLabel}>{alert.severity.toUpperCase()}</Text>
          <Text style={styles.bannerTitle}>{alert.title}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.card}>
        <Text style={styles.body}>{alert.body}</Text>
      </View>

      {/* Meta */}
      <View style={styles.metaCard}>
        <MetaRow icon="source-branch" label="Source" value={alert.source || 'Unknown'} />
        <MetaRow icon="map-marker" label="Area" value={alert.district_code || 'National'} />
        <MetaRow icon="clock-outline" label="Issued" value={new Date(alert.created_at).toLocaleString('en-TT')} />
        {alert.expires_at && (
          <MetaRow icon="clock-end" label="Expires" value={new Date(alert.expires_at).toLocaleString('en-TT')} />
        )}
      </View>

      {/* Map (if location available) */}
      {alert.lat && alert.lng && (
        <View style={styles.mapContainer}>
          <Text style={styles.sectionTitle}>Affected Area</Text>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: alert.lat,
              longitude: alert.lng,
              latitudeDelta: alert.radius_km ? alert.radius_km * 0.03 : 0.1,
              longitudeDelta: alert.radius_km ? alert.radius_km * 0.03 : 0.1,
            }}
            scrollEnabled={false}
          >
            {alert.radius_km && (
              <Circle
                center={{ latitude: alert.lat, longitude: alert.lng }}
                radius={alert.radius_km * 1000}
                fillColor={`${color}22`}
                strokeColor={color}
                strokeWidth={2}
              />
            )}
            <Marker coordinate={{ latitude: alert.lat, longitude: alert.lng }} pinColor={color} />
          </MapView>
        </View>
      )}
    </ScrollView>
  );
}

function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color={Colors.textSecondary} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: Colors.textSecondary },
  severityBanner: { padding: 20, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  severityLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  card: {
    backgroundColor: Colors.surface, margin: 16, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  metaCard: {
    backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: 12, padding: 16, gap: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { fontSize: 13, color: Colors.textSecondary, width: 60 },
  metaValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', flex: 1 },
  mapContainer: { margin: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  map: { height: 200, borderRadius: 12 },
});
