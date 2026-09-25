import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';
import { registerPushToken, addNotificationListeners, removeNotificationListeners, setNotificationRouter, handleInitialNotificationResponse } from '../services/notificationService';
import '../services/locationService'; // registra a background task de GPS no boot do app
import { initIAP, closeIAP, setupPurchaseListeners, syncPlanWithSupabase } from '../services/iapService';

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const walkerProfile = useAuthStore((s) => s.walkerProfile);

  useEffect(() => {
    if (loading || profileLoading) return;

    const inAuth = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inAuth) router.replace('/auth/login');
      return;
    }

    const inNotWalker = segments[0] === 'auth' && segments[1] === 'not-a-walker';

    if (!walkerProfile && !inOnboarding && !inNotWalker) {
      router.replace('/auth/not-a-walker');
      return;
    }

    if (walkerProfile && (inAuth || inOnboarding)) {
      router.replace('/(tabs)');
      return;
    }
  }, [session, loading, profileLoading, walkerProfile, segments]);

  return null;
}

export default function RootLayout() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const fetchWalkerProfile = useAuthStore((s) => s.fetchWalkerProfile);
  const forceReady = useAuthStore((s) => s.forceReady);
  const walkerProfile = useAuthStore((s) => s.walkerProfile);
  const notifCleanup = useRef<(() => void) | null>(null);
  // Guarda o último uid para evitar fetchWalkerProfile duplicado quando
  // getSession() e onAuthStateChange disparam juntos no boot
  const lastFetchedUid = useRef<string | null>(null);

  const safeFetchProfile = (uid: string | undefined) => {
    if (!uid || uid === lastFetchedUid.current) return;
    lastFetchedUid.current = uid;
    fetchWalkerProfile(uid);
  };

  // Registrar push token quando o perfil do walker estiver disponível
  useEffect(() => {
    if (!walkerProfile?.id) return;
    registerPushToken(walkerProfile.id);
  }, [walkerProfile?.id]);

  // IAP: inicializa conexão e escuta compras concluídas
  useEffect(() => {
    initIAP();
    const cleanup = setupPurchaseListeners(
      async (purchase) => {
        if (walkerProfile?.id) {
          const txId = (purchase as any).originalTransactionIdentifier ?? (purchase as any).transactionIdentifier;
          await syncPlanWithSupabase(walkerProfile.id, true, txId);
          fetchWalkerProfile(walkerProfile.id);
        }
      },
      (error) => {
        if (__DEV__) console.warn('[IAP] Erro:', error);
      }
    );
    return () => {
      cleanup();
      closeIAP();
    };
  }, [walkerProfile?.id]);

  // Listeners de notificação (recebida em foreground / tap)
  useEffect(() => {
    setNotificationRouter(router);
    notifCleanup.current = addNotificationListeners();
    return () => { notifCleanup.current?.(); };
  }, []);

  // Trata notificação que abriu o app do estado fechado — só navega após perfil carregado
  useEffect(() => {
    if (!walkerProfile?.id) return;
    handleInitialNotificationResponse();
  }, [walkerProfile?.id]);

  useEffect(() => {
    // Fallback: se o Supabase não responder em 8s, desbloqueia o AuthGuard
    const timeout = setTimeout(() => forceReady(), 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      safeFetchProfile(session?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Ao fazer logout, reseta o ref para permitir novo fetch no próximo login
      if (!session) { lastFetchedUid.current = null; return; }
      safeFetchProfile(session.user.id);
    });

    // Trata deep link OAuth — tokens chegam no fragment (#) não na query string
    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url.includes('access_token')) return;

      // Extrai fragment (#...) ou query string (?...)
      const hashIndex = url.indexOf('#');
      const queryIndex = url.indexOf('?');
      const paramStr = hashIndex !== -1
        ? url.slice(hashIndex + 1)
        : queryIndex !== -1 ? url.slice(queryIndex + 1) : '';

      const params = Object.fromEntries(new URLSearchParams(paramStr));
      const accessToken  = params['access_token'];
      const refreshToken = params['refresh_token'];

      if (accessToken && refreshToken) {
        const { data } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        // onAuthStateChange pode não disparar para sessões setadas manualmente — chama diretamente
        if (data.session) {
          setSession(data.session);
          safeFetchProfile(data.session.user.id);
        }
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    const linkSub = Linking.addEventListener('url', handleDeepLink);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="walk/start" />
        <Stack.Screen name="walk/active" options={{ gestureEnabled: false }} />
        <Stack.Screen name="walk/summary" options={{ gestureEnabled: false }} />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="auth/not-a-walker" />
        <Stack.Screen name="auth/walker-callback" />
        <Stack.Screen name="onboarding/walker-profile" />
        <Stack.Screen name="invite/index" />
        <Stack.Screen name="services/index" />
        <Stack.Screen name="walker-connect" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="walk-report-detail" />
      </Stack>
    </SafeAreaProvider>
  );
}
