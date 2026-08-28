import { supabase } from './supabase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

type ErrorType = 'crash' | 'sync_error' | 'api_error' | 'validation' | 'unknown';

interface ErrorLogParams {
  errorType?: ErrorType;
  errorCode?: string;
  message: string;
  stackTrace?: string;
  screen?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

async function logError(params: ErrorLogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('app_errors').insert({
      app:         'zupet-walker',
      user_id:     user?.id ?? null,
      error_type:  params.errorType ?? 'unknown',
      error_code:  params.errorCode ?? null,
      message:     params.message,
      stack_trace: params.stackTrace ?? null,
      screen:      params.screen ?? null,
      action:      params.action ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      platform:    Platform.OS,
      os_version:  String(Platform.Version),
      metadata:    params.metadata ?? {},
    });
  } catch {
    // silencia — log de erro não pode lançar exceção
  }
}

export function setupGlobalErrorHandler(): void {
  const EU = (globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | null;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;

  if (!EU) return;

  const originalHandler = EU.getGlobalHandler();

  EU.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logError({
      errorType:  'crash',
      message:    error?.message ?? 'Erro desconhecido',
      stackTrace: error?.stack,
      metadata:   { isFatal: isFatal ?? false },
    }).catch(() => {});
    originalHandler?.(error, isFatal);
  });
}

export { logError };
