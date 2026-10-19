import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../lib/api';
import { requestPasswordReset, resetPassword } from '../lib/auth';
import { colors, radius, spacing } from '../theme';

type Step = 'email' | 'reset' | 'done';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'No pudimos conectar con el servidor. Intenta de nuevo.';
}

function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir al menos una letra y un número.';
  }
  if (password !== confirmation) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleRequest() {
    setError(null);
    setInfo(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Ingresa el correo de tu cuenta.');
      return;
    }

    setBusy(true);
    try {
      const response = await requestPasswordReset(email.trim());
      setDevCode(response.devCode);
      setStep('reset');
      setInfo('Si el correo existe, enviamos un código de recuperación.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    const passwordError = passwordProblem(password, confirmation);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setBusy(true);
    try {
      await resetPassword(email.trim(), code, password);
      setStep('done');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (step === 'email' ? router.back() : setStep('email'))}
            style={styles.back}
          >
            <Text style={styles.backText}>← Volver</Text>
          </Pressable>

          {step === 'done' ? (
            <View style={styles.doneCard}>
              <Text style={styles.title}>Contraseña actualizada</Text>
              <Text style={styles.subtitle}>
                Cerramos las sesiones abiertas por seguridad. Ya puedes entrar con tu nueva
                contraseña.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/auth?mode=login')}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Iniciar sesión</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.eyebrow}>Recuperar acceso</Text>
                <Text style={styles.title}>
                  {step === 'email' ? '¿Olvidaste tu contraseña?' : 'Crea una nueva contraseña'}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 'email'
                    ? 'Escribe el correo de tu cuenta y te enviaremos un código.'
                    : `Ingresa el código enviado a ${email.trim()} y define tu nueva contraseña.`}
                </Text>
              </View>

              <View style={styles.form}>
                {step === 'email' ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>Correo electrónico</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="ana@correo.com"
                      placeholderTextColor="#9AA8A4"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Código de 6 dígitos</Text>
                      <TextInput
                        value={code}
                        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        placeholderTextColor="#9AA8A4"
                        keyboardType="number-pad"
                        maxLength={6}
                        style={styles.codeInput}
                      />
                    </View>

                    {devCode ? (
                      <View style={styles.devBox}>
                        <Text style={styles.devLabel}>Código de desarrollo</Text>
                        <Text style={styles.devCode}>{devCode}</Text>
                        <Text style={styles.devHint}>También llega a Mailpit (localhost:8025)</Text>
                      </View>
                    ) : null}

                    <View style={styles.field}>
                      <Text style={styles.label}>Nueva contraseña</Text>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Mínimo 8 caracteres"
                        placeholderTextColor="#9AA8A4"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Confirmar contraseña</Text>
                      <TextInput
                        value={confirmation}
                        onChangeText={setConfirmation}
                        placeholder="Repite la contraseña"
                        placeholderTextColor="#9AA8A4"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                      />
                    </View>
                  </>
                )}

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={step === 'email' ? handleRequest : handleReset}
                  style={[styles.button, busy && styles.buttonBusy]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {step === 'email' ? 'Enviar código' : 'Cambiar contraseña'}
                    </Text>
                  )}
                </Pressable>
              </View>

              {info ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>{info}</Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  back: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  backText: { color: colors.brand, fontWeight: '600', fontSize: 14 },
  header: { gap: spacing.sm, marginTop: spacing.sm },
  eyebrow: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.muted },
  form: { gap: spacing.md },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.text,
  },
  devBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  devLabel: { color: colors.brandDark, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  devCode: { color: colors.brandDark, fontSize: 26, fontWeight: '800', letterSpacing: 6 },
  devHint: { color: colors.muted, fontSize: 11 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: spacing.xs,
  },
  buttonBusy: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  infoBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.md },
  infoText: { color: colors.brandDark, fontSize: 13, lineHeight: 19 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  doneCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
