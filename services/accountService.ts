import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export type DeleteAccountResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error ?? 'Erro ao excluir conta.' };
    }

    await AsyncStorage.clear();
    await supabase.auth.signOut({ scope: 'local' });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Erro inesperado.' };
  }
}
