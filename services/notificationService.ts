import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// expo-notifications dispara DevicePushTokenAutoRegistration ao ser importado,
// o que gera ERROR no Expo Go (SDK 53+). Por isso o import é sempre lazy —
// só acontece em builds reais, após verificar isExpoGo.
const isExpoGo = Constants.appOwnership === 'expo';

function getNotifications() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications') as typeof import('expo-notifications');
}

if (!isExpoGo) {
  getNotifications().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function isPhysicalDevice(): boolean {
  return Constants.isDevice ?? false;
}

type RouterLike = { push: (path: string) => void };

let _router: RouterLike | null = null;

export function setNotificationRouter(router: RouterLike) {
  _router = router;
}

function navigateFromNotificationData(data: Record<string, any>) {
  if (!_router) return;
  const type = data?.type as string | undefined;
  if (type === 'pet_link_request' || type === 'pet_link_accepted' || type === 'pet_link_rejected') {
    _router.push('/(tabs)/pets');
  } else if (type === 'walk_report' || type === 'walk_session') {
    _router.push('/(tabs)');
  } else if (type === 'payment') {
    _router.push('/payments');
  } else {
    _router.push('/notifications');
  }
}

export function addNotificationListeners(): () => void {
  if (isExpoGo) return () => {};
  const Notifications = getNotifications();

  const recv = Notifications.addNotificationReceivedListener(() => {});

  const resp = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, any>;
    navigateFromNotificationData(data);
  });

  return () => { recv.remove(); resp.remove(); };
}

// Chamado após o router estar pronto — lida com notificações que abriram o app do estado fechado
export async function handleInitialNotificationResponse(): Promise<void> {
  if (isExpoGo) return;
  try {
    const Notifications = getNotifications();
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;
    const data = response.notification.request.content.data as Record<string, any>;
    navigateFromNotificationData(data);
  } catch {}
}

export function removeNotificationListeners() {
  // Mantido para compatibilidade com o import no _layout.tsx
  // A limpeza real é feita pelo retorno de addNotificationListeners
}

export async function registerPushToken(walkerId: string): Promise<void> {
  if (isExpoGo || !isPhysicalDevice()) return;

  const Notifications = getNotifications();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#40E0D0',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? '';
  if (!projectId) return;

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return;
  }
  if (!token) return;

  await supabase.from('push_tokens').upsert(
    { walker_id: walkerId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
    { onConflict: 'walker_id,token' }
  );
}

export async function unregisterPushToken(walkerId: string): Promise<void> {
  if (isExpoGo || !isPhysicalDevice()) return;
  try {
    const Notifications = getNotifications();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (token) {
      await supabase.from('push_tokens').delete()
        .eq('walker_id', walkerId).eq('token', token);
    }
  } catch {}
}

export function sendLocalNotification(title: string, body: string): void {
  if (isExpoGo) return;
  getNotifications().scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}
