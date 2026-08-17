import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../services/supabase';
import { Colors } from '../../constants/colors';

// Tela intermediária que recebe o redirect do OAuth
// O _layout.tsx já monitora onAuthStateChange e redireciona automaticamente
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      const params = parsed.queryParams ?? {};
      const accessToken  = params['access_token']  as string | undefined;
      const refreshToken = params['refresh_token'] as string | undefined;

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    };

    // URL que abriu o app
    Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });

    const sub = Linking.addEventListener('url', handleUrl);
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
