import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getActiveSubscriptions,
  restorePurchases as syncRestore,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';
import { supabase } from './supabase';

export const PRO_MONTHLY_ID = 'io.zupet.walker.pro.monthly';

let connectionInitialized = false;

export async function initIAP(): Promise<void> {
  if (Platform.OS !== 'ios' || connectionInitialized) return;
  try {
    await initConnection();
    connectionInitialized = true;
  } catch {
    // IAP não disponível neste dispositivo
  }
}

export async function closeIAP(): Promise<void> {
  if (!connectionInitialized) return;
  try {
    await endConnection();
  } catch {}
  connectionInitialized = false;
}

export async function getProSubscription() {
  if (Platform.OS !== 'ios') return null;
  try {
    await initIAP();
    const products = await fetchProducts({ skus: [PRO_MONTHLY_ID], type: 'subs' });
    return products?.[0] ?? null;
  } catch (e) {
    console.warn('[IAP] fetchProducts falhou', e);
    return null;
  }
}

export async function purchasePro(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'ios') return { success: false, error: 'IAP disponível apenas no iOS' };
  try {
    await initIAP();
    // StoreKit exige que o produto tenha sido carregado antes da compra
    const product = await getProSubscription();
    if (!product) {
      return { success: false, error: 'Assinatura indisponível no momento. Tente novamente em instantes.' };
    }
    await requestPurchase({
      request: {
        apple: { sku: PRO_MONTHLY_ID },
      },
      type: 'subs',
    });
    return { success: true };
  } catch (e: any) {
    if (e?.code === 'E_USER_CANCELLED') return { success: false };
    return { success: false, error: e?.message ?? 'Erro ao processar compra' };
  }
}

export async function checkActiveSubscription(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    await initIAP();
    const active = await getActiveSubscriptions([PRO_MONTHLY_ID]);
    return active.length > 0;
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<{ active: boolean; transactionId?: string }> {
  if (Platform.OS !== 'ios') return { active: false };
  try {
    await initIAP();
    // Sincroniza com a App Store (pode pedir login do Apple ID) antes de consultar
    try { await syncRestore(); } catch {}
    const active = await getActiveSubscriptions([PRO_MONTHLY_ID]);
    const current = active.find((s) => s.isActive) ?? active[0];
    return { active: !!current, transactionId: current?.transactionId };
  } catch (e) {
    console.warn('[IAP] restore falhou', e);
    return { active: false };
  }
}

export async function syncPlanWithSupabase(
  walkerId: string,
  isPro: boolean,
  originalTransactionId?: string
): Promise<void> {
  const update: Record<string, unknown> = { plan: isPro ? 'pro' : 'free' };
  if (originalTransactionId) {
    update.apple_original_transaction_id = originalTransactionId;
  }
  await supabase
    .from('walker_profiles')
    .update(update)
    .eq('id', walkerId);
}

export function setupPurchaseListeners(
  onSuccess: (purchase: any) => void,
  onError: Parameters<typeof purchaseErrorListener>[0]
) {
  const successSub = purchaseUpdatedListener(async (purchase) => {
    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch {}
    onSuccess(purchase);
  });
  const errorSub = purchaseErrorListener(onError);
  return () => {
    successSub.remove();
    errorSub.remove();
  };
}
