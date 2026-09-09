import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { logError } from './errorLogService';

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
  if (error) {
    console.error('[GPS task error]', error);
    logError({
      errorType: 'unknown',
      errorCode:  error?.code ?? 'GPS_TASK_ERROR',
      message:    error?.message ?? 'Erro na task de GPS em background',
      stackTrace: error?.stack,
      screen:     'walk/active',
      action:     'gpsBackgroundTask',
      metadata:   { raw: String(error) },
    }).catch(() => {});
    return;
  }

  const locations: Location.LocationObject[] = data?.locations ?? [];
  if (locations.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useWalkStore } = require('../stores/walkStore');
  const store = useWalkStore.getState();
  const latest = locations[locations.length - 1];

  console.log('[GPS task] ponto recebido', latest.coords.latitude, latest.coords.longitude, 'activeWalk:', !!store.activeWalk);

  if (!store.activeWalk) return;

  store.addLocationPoint(latest.coords.latitude, latest.coords.longitude);
});

export async function startLocationTracking() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('[GPS] foreground permission:', status);
    if (status !== 'granted') {
      logError({
        errorType: 'unknown',
        errorCode:  'GPS_PERMISSION_DENIED',
        message:    'Permissão de localização em primeiro plano negada',
        screen:     'walk/active',
        action:     'startLocationTracking',
        metadata:   { status },
      }).catch(() => {});
      return false;
    }

    const bgPerm = await Location.requestBackgroundPermissionsAsync();
    console.log('[GPS] background permission:', bgPerm.status);
    if (bgPerm.status !== 'granted') {
      logError({
        errorType: 'unknown',
        errorCode:  'GPS_BACKGROUND_PERMISSION_DENIED',
        message:    'Permissão de localização em background negada',
        screen:     'walk/active',
        action:     'startLocationTracking',
        metadata:   { status: bgPerm.status },
      }).catch(() => {});
    }

    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (alreadyRunning) {
      console.log('[GPS] já está rodando, skip startLocationUpdatesAsync');
      return true;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Zupet Walker',
        notificationBody: 'Rastreando passeio em andamento...',
        notificationColor: '#00C6A7',
      },
    });

    return true;
  } catch (err: any) {
    console.error('[GPS] erro ao iniciar rastreamento:', err);
    logError({
      errorType: 'crash',
      errorCode:  err?.code ?? 'GPS_START_ERROR',
      message:    err?.message ?? 'Falha ao iniciar rastreamento de localização',
      stackTrace: err?.stack,
      screen:     'walk/active',
      action:     'startLocationTracking',
      metadata:   { code: err?.code, raw: String(err) },
    }).catch(() => {});
    return false;
  }
}

export async function stopLocationTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
