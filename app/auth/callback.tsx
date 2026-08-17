import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Colors } from '../../constants/colors';
import * as Linking from 'expo-linking';

export default function AuthCallbackScreen() {
  const setSession = useAuthStore((s) => s.setSession);
  const fetchWalkerProfile = useAuthStore((s) => s.fetchWalkerProfile);

  useEffect(() => {
    const handle = async (url: string) => {
      if (!url.includes('access_token')) return;

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
        if (data.session) {
          setSession(data.session);
          fetchWalkerProfile(data.session.user.id);
        }
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handle(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
});
