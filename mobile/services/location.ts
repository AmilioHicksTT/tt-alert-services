import * as Location from 'expo-location';

export interface Coords {
  lat: number;
  lng: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<Coords | null> {
  const granted = await requestLocationPermission();
  if (!granted) return null;

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}

export async function watchLocation(
  callback: (coords: Coords) => void
): Promise<Location.LocationSubscription> {
  await requestLocationPermission();
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 500 },
    (loc) => callback({ lat: loc.coords.latitude, lng: loc.coords.longitude })
  );
}
