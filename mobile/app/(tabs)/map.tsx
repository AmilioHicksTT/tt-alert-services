import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { alertsApi, reportsApi } from '../../services/api';
import { Colors, AlertTypeColors } from '../../constants/colors';

type MapLayer = 'alerts' | 'reports' | 'both';

export default function MapScreen() {
  const { location, alerts, setAlerts, reports, setReports } = useStore();
  const [layer, setLayer] = useState<MapLayer>('both');
  const [selected, setSelected] = useState<any>(null);
  const mapRef = useRef<MapView>(null);

  const initialRegion = {
    latitude: location?.lat || 10.52,
    longitude: location?.lng || -61.40,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8,
  };

  useEffect(() => {
    async function load() {
      const params = location ? { lat: location.lat, lng: location.lng, radius: 100 } : {};
      const [alertsRes, reportsRes] = await Promise.allSettled([
        alertsApi.list(params),
        reportsApi.list(params),
      ]);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data);
      if (reportsRes.status === 'fulfilled') setReports(reportsRes.value.data);
    }
    load();
  }, []);

  function zoomToLocation() {
    if (!location) return;
    mapRef.current?.animateToRegion({
      latitude: location.lat, longitude: location.lng,
      latitudeDelta: 0.1, longitudeDelta: 0.1,
    }, 600);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Alert markers + radius */}
        {(layer === 'alerts' || layer === 'both') && alerts.filter((a) => a.lat && a.lng).map((alert) => (
          <View key={alert.id}>
            {alert.radius_km && (
              <Circle
                center={{ latitude: alert.lat!, longitude: alert.lng! }}
                radius={alert.radius_km * 1000}
                fillColor={`${AlertTypeColors[alert.type]}22`}
                strokeColor={AlertTypeColors[alert.type]}
                strokeWidth={1}
              />
            )}
            <Marker
              coordinate={{ latitude: alert.lat!, longitude: alert.lng! }}
              onPress={() => setSelected({ kind: 'alert', data: alert })}
              pinColor={AlertTypeColors[alert.type] || Colors.info}
            />
          </View>
        ))}

        {/* Report markers */}
        {(layer === 'reports' || layer === 'both') && reports.filter((r) => r.lat && r.lng).map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.lat, longitude: report.lng }}
            onPress={() => setSelected({ kind: 'report', data: report })}
            pinColor={Colors.warning}
          />
        ))}
      </MapView>

      {/* Layer toggles */}
      <SafeAreaView edges={['top']} style={styles.controls}>
        <View style={styles.layerBar}>
          {(['both', 'alerts', 'reports'] as MapLayer[]).map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.layerBtn, layer === l && styles.layerBtnActive]}
              onPress={() => setLayer(l)}
            >
              <Text style={[styles.layerBtnText, layer === l && styles.layerBtnTextActive]}>
                {l === 'both' ? 'All' : l === 'alerts' ? 'Alerts' : 'Reports'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* My location button */}
      <TouchableOpacity style={styles.locBtn} onPress={zoomToLocation}>
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={Colors.primary} />
      </TouchableOpacity>

      {/* Detail panel */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelected(null)}>
          <View style={styles.detailPanel}>
            {selected?.kind === 'alert' && (
              <>
                <View style={[styles.detailTypeBar, { backgroundColor: AlertTypeColors[selected.data.type] }]} />
                <Text style={styles.detailTitle}>{selected.data.title}</Text>
                <Text style={styles.detailBody}>{selected.data.body}</Text>
                <Text style={styles.detailMeta}>Source: {selected.data.source || 'Unknown'}</Text>
                <Text style={styles.detailMeta}>Severity: {selected.data.severity.toUpperCase()}</Text>
              </>
            )}
            {selected?.kind === 'report' && (
              <>
                <Text style={styles.detailTitle}>{selected.data.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
                {selected.data.description && <Text style={styles.detailBody}>{selected.data.description}</Text>}
                <Text style={styles.detailMeta}>{selected.data.upvotes} people confirmed this</Text>
                <Text style={styles.detailMeta}>Status: {selected.data.status}</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { position: 'absolute', top: 0, left: 0, right: 0 },
  layerBar: {
    flexDirection: 'row', margin: 12, backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20, padding: 4, alignSelf: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  layerBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  layerBtnActive: { backgroundColor: Colors.primary },
  layerBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  layerBtnTextActive: { color: '#fff' },
  locBtn: {
    position: 'absolute', bottom: 32, right: 16,
    backgroundColor: '#fff', borderRadius: 24, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  detailPanel: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  detailTypeBar: { height: 4, borderRadius: 2, marginBottom: 12 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  detailBody: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12, lineHeight: 20 },
  detailMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
});
