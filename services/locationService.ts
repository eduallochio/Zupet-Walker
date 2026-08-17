import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const LOCATION_TASK = 'zupet-walker-location';

// Calcula distância em metros entre dois pontos (Haversine)
export function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Task de background — chamada pelo SO com novas localizações
// useWalkStore é importado via require lazy para evitar require cycle
TaskManager.defineTask(LOCATION_TASK, ({ data, error }: any) => {
  if (error) { console.error('[GPS task]', error); return; }
  const locations: Location.LocationObject[] = data?.locations ?? [];
  if (locations.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useWalkStore } = require('../stores/walkStore');
  const store = useWalkStore.getState();
  if (!store.activeWalk) return;

  const latest = locations[locations.length - 1];
  store.addLocationPoint(latest.coords.latitude, latest.coords.longitude);
});

export async function startLocationTracking() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return false;

  await Location.requestBackgroundPermissionsAsync();

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,       // atualiza a cada 10 metros
    timeInterval: 5000,         // ou a cada 5 segundos
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Zupet Walker',
      notificationBody: 'Rastreando passeio em andamento...',
      notificationColor: '#00C6A7',
    },
  });

  return true;
}

export async function stopLocationTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
