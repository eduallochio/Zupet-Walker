import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { supabase } from '../../services/supabase';
import { Colors } from '../../constants/colors';

// No Expo Go o scheme customizado não funciona — login social requer APK/build nativa
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const REDIRECT_URL = 'zupet-walker://auth/callback';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [showRegister, setShowRegister]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Preencha e-mail e senha'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro ao entrar', error.message);
  };

  const handleRegister = async () => {
    if (!email || !password) { Alert.alert('Preencha e-mail e senha'); return; }
    if (password.length < 6) { Alert.alert('Senha muito curta', 'Use ao menos 6 caracteres.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro ao cadastrar', error.message);
    else Alert.alert('Confirme seu e-mail', 'Enviamos um link de confirmação para o seu e-mail.');
  };

  const handleGoogle = async () => {
    if (IS_EXPO_GO) {
      Alert.alert(
        'Não disponível no Expo Go',
        'O login com Google requer um build nativo do app. Use e-mail e senha para testar.',
      );
      return;
    }
    setSocialLoading('google');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
    });
    setSocialLoading(null);
    if (error) { Alert.alert('Erro', error.message); return; }
    if (data?.url) await Linking.openURL(data.url);
  };

  const handleApple = async () => {
    if (IS_EXPO_GO) {
      Alert.alert(
        'Não disponível no Expo Go',
        'O login com Apple requer um build nativo do app. Use e-mail e senha para testar.',
      );
      return;
    }
    setSocialLoading('apple');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
    });
    setSocialLoading(null);
    if (error) { Alert.alert('Erro', error.message); return; }
    if (data?.url) await Linking.openURL(data.url);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../assets/simbolo-branco-transparente.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>Zupet Walker</Text>
            <Text style={styles.appSub}>A plataforma dos Dog Walkers{'\n'}profissionais</Text>
          </View>

          {/* Formulário e-mail */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textSecondary}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={showRegister ? handleRegister : handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>{showRegister ? 'Criar conta' : 'Entrar'}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Divisor */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou entre com</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social — abaixo do formulário */}
          <View style={styles.socialGroup}>
            <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} activeOpacity={0.85} disabled={!!socialLoading}>
              {socialLoading === 'google'
                ? <ActivityIndicator color={Colors.text} size="small" />
                : <>
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                    <Text style={styles.socialBtnText}>Continuar com Google</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.appleBtn} onPress={handleApple} activeOpacity={0.85} disabled={!!socialLoading}>
              {socialLoading === 'apple'
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="logo-apple" size={20} color="#fff" />
                    <Text style={styles.appleBtnText}>Continuar com Apple</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          {/* Toggle modo */}
          <TouchableOpacity onPress={() => setShowRegister((v) => !v)} style={styles.toggleWrap}>
            <Text style={styles.toggleText}>
              {showRegister ? 'Já tem conta? ' : 'Não tem conta? '}
              <Text style={styles.toggleLink}>
                {showRegister ? 'Entrar' : 'Cadastrar como Walker'}
              </Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Ao entrar você concorda com os{' '}
            <Text style={styles.footerLink}>Termos de Uso</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 24 },

  logoSection: { alignItems: 'center', gap: 10 },
  logoBox: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  logoImg: { width: 44, height: 44 },
  appName: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  appSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  socialGroup: { gap: 12 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 52, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 52, borderRadius: 12, backgroundColor: '#000',
  },
  appleBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textSecondary },

  form: { gap: 14 },
  field: { gap: 5 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  eyeBtn: { padding: 4 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: Colors.text },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  toggleWrap: { alignItems: 'center' },
  toggleText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  toggleLink: { color: Colors.primary, fontWeight: '700' },

  footer: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  footerLink: { color: Colors.primary, fontWeight: '500' },
});
