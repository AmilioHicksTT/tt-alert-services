import { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'bell-alert',
    iconColor: Colors.primary,
    title: 'Real-Time Alerts',
    body: 'Get instant notifications for floods, power outages, road closures and weather warnings from ODPM, Met Office, WASA and T&TEC.',
  },
  {
    id: '2',
    icon: 'map-marker-radius',
    iconColor: '#3B82F6',
    title: 'Your Area, Your Alerts',
    body: 'Alerts are filtered to your district. Pick your region once and stay informed about what matters near you.',
  },
  {
    id: '3',
    icon: 'flag-plus',
    iconColor: '#F59E0B',
    title: 'Report Issues',
    body: 'Spot a burst main, flooding, or a fallen tree? Submit a community report in seconds so your neighbours know too.',
  },
  {
    id: '4',
    icon: 'bus-clock',
    iconColor: '#16A34A',
    title: 'Track Transport',
    body: 'Check live PTSC, Maxi Taxi and Water Taxi delays before you head out. No more surprises at City Gate.',
  },
];

async function markWelcomeSeen() {
  await SecureStore.setItemAsync('has_seen_welcome', 'true');
}

export default function WelcomeScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  }, []);

  async function goToOnboarding() {
    await markWelcomeSeen();
    router.replace('/onboarding');
  }

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToOffset({
        offset: (activeIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      goToOnboarding();
    }
  }

  return (
    <LinearGradient colors={['#C8102E', '#8B0000']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipBtn} onPress={goToOnboarding}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.flag}>🇹🇹</Text>
          <Text style={styles.appTitle}>T&T Alert + Services</Text>
          <Text style={styles.appSub}>Your national civic utility app</Text>
        </View>

        {/* Carousel */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.card}>
                <View style={[styles.iconCircle, { backgroundColor: item.iconColor + '18' }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={48} color={item.iconColor} />
                </View>
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideBody}>{item.body}</Text>
              </View>
            </View>
          )}
        />

        {/* Pagination dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity style={styles.ctaBtn} onPress={handleNext}>
          <Text style={styles.ctaText}>
            {activeIndex < SLIDES.length - 1 ? 'Next' : 'Get Started'}
          </Text>
          <MaterialCommunityIcons
            name={activeIndex < SLIDES.length - 1 ? 'arrow-right' : 'check'}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  skipBtn: {
    position: 'absolute', top: 56, right: 24, zIndex: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  skipText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 16 },
  flag: { fontSize: 40, marginBottom: 8 },
  appTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  appSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  slideBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#fff', width: 24 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.4)' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingVertical: 16,
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
