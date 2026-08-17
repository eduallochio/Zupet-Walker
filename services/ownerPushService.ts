import { supabase } from './supabase';

const EXPO_PUSH_URL = 'https://exp.host/push/send';

async function getOwnerExpoPushToken(ownerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('expo_push_token')
    .eq('user_id', ownerId)
    .maybeSingle();
  return (data as any)?.expo_push_token ?? null;
}

export async function sendPushToOwner(
  ownerId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const token = await getOwnerExpoPushToken(ownerId);
    if (!token) return;
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: 'default' }),
    });
  } catch { /* best-effort */ }
}
