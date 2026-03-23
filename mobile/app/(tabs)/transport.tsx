import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStore } from '../../store';
import { transportApi } from '../../services/api';
import { Colors } from '../../constants/colors';

type FilterType = 'all' | 'ptsc' | 'maxi_taxi' | 'water_taxi';

const STATUS_COLORS = {
  normal: '#16A34A',
  delayed: Colors.warning,
  cancelled: Colors.critical,
  unknown: Colors.textMuted,
};

export default function TransportScreen() {
  const { routes, setRoutes } = useStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [crowdNote, setCrowdNote] = useState('');
  const [crowdDelay, setCrowdDelay] = useState('');

  async function fetchRoutes() {
    const params = filter !== 'all' ? { type: filter } : {};
    const { data } = await transportApi.routes(params);
    setRoutes(data);
  }

  useEffect(() => {
    setLoading(true);
    fetchRoutes().finally(() => setLoading(false));
  }, [filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRoutes();
    setRefreshing(false);
  };

  async function submitCrowdReport() {
    if (!selected) return;
    try {
      await transportApi.crowdReport(selected.id, parseInt(crowdDelay) || 0, crowdNote);
      Alert.alert('Thank you', 'Your report has been submitted.');
      setSelected(null);
      setCrowdNote('');
      setCrowdDelay('');
      await fetchRoutes();
    } catch {
      Alert.alert('Error', 'Could not submit report. Try again.');
    }
  }

  const filtered = filter === 'all' ? routes : routes.filter((r) => r.type === filter);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter tabs */}
      <View style={styles.filterBar}>
        {(['all', 'ptsc', 'maxi_taxi', 'water_taxi'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'ptsc' ? 'PTSC' : f === 'maxi_taxi' ? 'Maxi' : 'Water'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="bus-off" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No routes found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.routeCard} onPress={() => setSelected(item)}>
              <View style={styles.routeLeft}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || Colors.textMuted }]} />
                <View>
                  <Text style={styles.routeCode}>{item.code}</Text>
                  <Text style={styles.routeName}>{item.name}</Text>
                  {(item.origin || item.destination) && (
                    <Text style={styles.routeRoute}>
                      {item.origin} → {item.destination}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.routeRight}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || Colors.textMuted }]}>
                  {item.status === 'normal' ? 'On time' : item.status === 'delayed' ? `+${item.delay_mins}m` : item.status}
                </Text>
                <Text style={styles.routeType}>{item.type.replace('_', ' ')}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Route detail + crowd report modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelected(null)}>
          <View style={styles.detailPanel} onStartShouldSetResponder={() => true}>
            {selected && (
              <>
                <Text style={styles.detailCode}>{selected.code}</Text>
                <Text style={styles.detailName}>{selected.name}</Text>
                {selected.origin && (
                  <Text style={styles.detailRoute}>{selected.origin} → {selected.destination}</Text>
                )}
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS] + '22' }]}>
                  <Text style={[styles.statusPillText, { color: STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS] }]}>
                    {selected.status === 'delayed' ? `Delayed ~${selected.delay_mins} minutes` : selected.status}
                  </Text>
                </View>
                {selected.status_note && <Text style={styles.statusNote}>{selected.status_note}</Text>}

                <Text style={styles.crowdTitle}>Report a delay</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Delay in minutes (0 if on time)"
                  keyboardType="number-pad"
                  value={crowdDelay}
                  onChangeText={setCrowdDelay}
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Add a note (optional)"
                  value={crowdNote}
                  onChangeText={setCrowdNote}
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity style={styles.submitBtn} onPress={submitCrowdReport}>
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.background },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { padding: 12, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.textMuted, marginTop: 12, fontSize: 15 },
  routeCard: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  routeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  routeCode: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  routeName: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  routeRoute: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  routeRight: { alignItems: 'flex-end' },
  statusText: { fontSize: 13, fontWeight: '700' },
  routeType: { fontSize: 11, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  detailPanel: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  detailCode: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  detailName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  detailRoute: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  statusPillText: { fontSize: 13, fontWeight: '700' },
  statusNote: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  crowdTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12,
    fontSize: 14, color: Colors.textPrimary,
  },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
