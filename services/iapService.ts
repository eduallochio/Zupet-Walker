import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  getActiveSubscriptions,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type SubscriptionPurchase,
  type PurchaseError,
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
  await endConnection();
  connectionInitialized = false;
}

export async function getProSubscription() {
  if (Platform.OS !== 'ios') return null;
  await initIAP();
  const subs = await getSubscriptions({ skus: [PRO_MONTHLY_ID] });
  return subs[0] ?? null;
}

export async function purchasePro(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'ios') return { success: false, error: 'IAP disponível apenas no iOS' };
  try {
    await initIAP();
    await requestSubscription({ sku: PRO_MONTHLY_ID });
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
    const active = await getActiveSubscriptions();
    return active.some((p) => p.productId === PRO_MONTHLY_ID);
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  return checkActiveSubscription();
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
  onSuccess: (purchase: SubscriptionPurchase) => void,
  onError: (error: PurchaseError) => void
) {
  const successSub = purchaseUpdatedListener(async (purchase) => {
    await finishTransaction({ purchase, isConsumable: false });
    onSuccess(purchase as SubscriptionPurchase);
  });
  const errorSub = purchaseErrorListener(onError);
  return () => {
    successSub.remove();
    errorSub.remove();
  };
}
