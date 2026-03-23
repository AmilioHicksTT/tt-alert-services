import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { useStore } from '../store';
import { registerForPushNotifications, useNotificationListeners } from '../services/notifications';
import { subscribeToArea } from '../services/socket';
import { getCurrentLocation } from '../services/location';
import { areaApi, DEMO_MODE } from '../services/api';
import { MOCK_USER, MOCK_SUMMARY } from '../services/mockData';
import { Colors } from '../constants/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, token, loadStoredAuth, setLocation, setSummary, setAuth } = useStore();
  const [ready, setReady] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const seen = await SecureStore.getItemAsync('has_seen_welcome');
        setHasSeenWelcome(seen === 'true');

        if (DEMO_MODE) {
          await setAuth(MOCK_USER, 'demo-token');
          setSummary(MOCK_SUMMARY);
        } else {
          await loadStoredAuth();
        }
      } catch (e) {
        console.warn('Init error:', e);
      } finally {
        setReady(true);
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  // Auth guard — only run after init is complete
  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === 'onboarding'
      || segments[0] === 'welcome'
      || segments[0] === 'settings';

    if (!token && !inAuthGroup) {
      if (!hasSeenWelcome) {
        router.replace('/welcome');
      } else {
        router.replace('/onboarding');
      }
    } else if (token && (segments[0] === 'onboarding' || segments[0] === 'welcome')) {
      router.replace('/');
    }
  }, [token, ready, segments, hasSeenWelcome]);

  // Location + area data on login
  useEffect(() => {
    if (!user) return;
    if (DEMO_MODE) {
      setLocation({ lat: 10.6549, lng: -61.5019 });
      return;
    }
    (async () => {
      try {
        const coords = await getCurrentLocation();
        if (coords) {
          setLocation(coords);
          const params = user.district_code
            ? { district: user.district_code }
            : { lat: coords.lat, lng: coords.lng };
          const { data } = await areaApi.summary(params);
          setSummary(data);
        }

        if (user.district_code) subscribeToArea(user.district_code);
        await registerForPushNotifications();
      } catch (e) {
        console.warn('Failed to load initial data:', e);
      }
    })();
  }, [user?.id]);

  // Real-time WebSocket push to store
  const { addAlert, addReport } = useStore();
  useEffect(() => {
    try {
      const { getSocket } = require('../services/socket');
      const socket = getSocket();
      if (!socket) return;
      socket.on('alert:new', addAlert);
      socket.on('report:new', addReport);
      return () => {
        socket.off('alert:new', addAlert);
        socket.off('report:new', addReport);
      };
    } catch (e) {
      console.warn('Socket setup failed:', e);
    }
  }, [addAlert, addReport]);

  useEffect(() => {
    try {
      return useNotificationListeners(
        (notification) => {
          console.log('Notification received:', notification);
        },
        (response) => {
          const data = response.notification.request.content.data;
          if (data?.alertId) router.push(`/alert/${data.alertId}`);
        }
      );
    } catch (e) {
      console.warn('Notification listeners setup failed:', e);
      return () => {};
    }
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alert/[id]" options={{
          presentation: 'modal', headerShown: true, title: 'Alert Detail',
          headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff',
        }} />
        <Stack.Screen name="settings" options={{
          presentation: 'modal', headerShown: true, title: 'Profile & Settings',
          headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff',
        }} />
      </Stack>
    </>
  );
}
