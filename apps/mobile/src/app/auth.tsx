import { useLocalSearchParams, useRouter } from 'expo-router';
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
import {
  loginWithPassword,
  resendOtp,
  startLoginOtp,
  startSignup,
  verifyLoginOtp,
  verifySignupEmail,
  verifySignupPhone,
} from '../lib/auth';
import { colors, radius, spacing } from '../theme';

type Step = 'start' | 'email-code' | 'phone-code' | 'login-code';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PHONE_PATTERN = /^\+?[\d\s-]{8,18}$/;

function phoneDigits(value: string): number {
  return value.replace(/\D/g, '').length;
}

function toE164(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) {
    return `+57${digits}`;
  }
  return `+${digits}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
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

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; mode?: string }>();
  const isVendor = params.role === 'vendor';
  const isLogin = params.mode === 'login';

  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [signupId, setSignupId] = useState<string | null>(null);
  const [emailForCode, setEmailForCode] = useState('');
  const [phoneForCode, setPhoneForCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const stepNumber = isLogin
    ? step === 'start'
      ? 1
      : 2
    : step === 'start'
      ? 1
      : step === 'email-code'
        ? 2
        : 3;
  const totalSteps = isLogin ? 2 : 3;

  const titles: Record<Step, string> = {
    start: isLogin
      ? 'Iniciar sesión'
      : isVendor
        ? 'Crea tu cuenta de vendedor'
        : 'Crea tu cuenta de comprador',
    'email-code': 'Verifica tu correo',
    'phone-code': 'Verifica tu celular',
    'login-code': 'Revisa tu correo',
  };

  const subtitles: Record<Step, string> = {
    start: isLogin
      ? 'Entra con tu contraseña o recibe un código por correo.'
      : isVendor
        ? 'Crea tu contraseña y verifica tu correo y celular. Después registrarás tu empresa.'
        : 'Crea tu contraseña y verifica tu correo y celular para empezar a pedir.',
    'email-code': `Ingresa el código de 6 dígitos que enviamos a ${emailForCode}.`,
    'phone-code': `Ingresa el código de 6 dígitos para ${phoneForCode}. En esta fase no enviamos SMS: el código se muestra abajo y queda registrado en la base.`,
    'login-code': `Enviamos un código de 6 dígitos a ${emailForCode}.`,
  };

  async function handleStart() {
    setError(null);
    setInfo(null);

    if (isLogin) {
      const identifierValue = identifier.trim();
      if (identifierValue.length < 5) {
        setError('Ingresa tu correo o tu celular.');
        return;
      }
      if (!identifierValue.includes('@') && phoneDigits(identifierValue) < 10) {
        setError('El celular debe tener al menos 10 dígitos.');
        return;
      }
      if (!password) {
        setError('Ingresa tu contraseña o entra con un código.');
        return;
      }

      setBusy(true);
      try {
        await loginWithPassword(
          identifierValue.includes('@') ? identifierValue : toE164(identifierValue),
          password,
        );
        router.replace('/home');
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (!PHONE_PATTERN.test(phone.trim()) || phoneDigits(phone) < 10) {
      setError('Ingresa un celular de al menos 10 dígitos, por ejemplo 300 123 4567.');
      return;
    }
    const passwordError = passwordProblem(password, confirmPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setBusy(true);
    try {
      const response = await startSignup({
        email: email.trim(),
        phone: toE164(phone.trim()),
        password,
        role: isVendor ? 'vendor' : 'buyer',
      });
      setSignupId(response.signupId);
      setEmailForCode(response.email);
      setDevCode(response.devCode);
      setCode('');
      if (response.next === 'verify_phone') {
        setPhoneForCode(response.phone ?? phone.trim());
        setStep('phone-code');
        setInfo('Ya verificaste tu correo. Falta confirmar tu celular.');
      } else {
        setStep('email-code');
        setInfo(`Código enviado a ${response.email}.`);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartOtp() {
    setError(null);
    setInfo(null);
    const identifierValue = identifier.trim();
    if (identifierValue.length < 5) {
      setError('Ingresa tu correo o tu celular para enviarte el código.');
      return;
    }
    if (!identifierValue.includes('@') && phoneDigits(identifierValue) < 10) {
      setError('El celular debe tener al menos 10 dígitos.');
      return;
    }

    setBusy(true);
    try {
      const response = await startLoginOtp(
        identifierValue.includes('@') ? identifierValue : toE164(identifierValue),
      );
      setEmailForCode(response.email);
      setDevCode(response.devCode);
      setCode('');
      setStep('login-code');
      setInfo(`Código enviado a ${response.email}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('El código tiene 6 dígitos.');
      return;
    }

    setBusy(true);
    try {
      if (step === 'email-code' && signupId) {
        const response = await verifySignupEmail(signupId, code);
        setPhoneForCode(response.phone);
        setDevCode(response.devCode);
        setCode('');
        setStep('phone-code');
        setInfo(`Correo verificado. Ahora confirma tu celular ${response.phone}.`);
      } else if (step === 'phone-code' && signupId) {
        await verifySignupPhone(signupId, code);
        router.replace('/home');
      } else if (step === 'login-code') {
        await verifyLoginOtp(
          identifier.trim().includes('@')
            ? identifier.trim()
            : toE164(identifier.trim()),
          code,
        );
        router.replace('/home');
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const destination =
        step === 'phone-code'
          ? phoneForCode
          : step === 'login-code'
            ? emailForCode
            : emailForCode || email;
      const response = await resendOtp({
        channel: step === 'phone-code' ? 'sms' : 'email',
        destination,
        purpose:
          step === 'phone-code' ? 'verify_phone' : step === 'login-code' ? 'login' : 'verify_email',
      });
      setDevCode(response.devCode);
      setInfo('Código reenviado. Revisa tu correo.');
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver al inicio"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Text style={styles.backText}>← Volver</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.stepText}>
              Paso {stepNumber} de {totalSteps}
            </Text>
            <Text style={styles.title}>{titles[step]}</Text>
            <Text style={styles.subtitle}>{subtitles[step]}</Text>
          </View>

          <View style={styles.progress}>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <View
                key={`step-${index}`}
                style={[styles.progressDot, index < stepNumber && styles.progressDotActive]}
              />
            ))}
          </View>

          {step === 'start' ? (
            <View style={styles.form}>
              {isLogin ? (
                <>
                  <Field
                    label="Correo o celular"
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="ana@correo.com o +57 300 123 4567"
                    keyboardType="email-address"
                  />
                  <PasswordField
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Tu contraseña"
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/reset-password')}
                    style={styles.forgot}
                  >
                    <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Field
                    label="Correo electrónico"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="ana@correo.com"
                    keyboardType="email-address"
                  />
                  <Field
                    label="Celular"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+57 300 123 4567"
                    keyboardType="phone-pad"
                  />
                  <PasswordField
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <PasswordField
                    label="Confirmar contraseña"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repite tu contraseña"
                  />
                  <Text style={styles.helper}>
                    Al menos 8 caracteres, con una letra y un número. Verificaremos tu correo y tu
                    celular con códigos.
                  </Text>
                </>
              )}

              <PrimaryButton
                label={isLogin ? 'Entrar' : 'Continuar'}
                busy={busy}
                onPress={handleStart}
              />

              {isLogin ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={handleStartOtp}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryText}>Entrar con un código por correo</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Código de 6 dígitos</Text>
                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor="#9AA8A4"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={styles.codeInput}
                />
              </View>

              {devCode ? (
                <View style={styles.devBox}>
                  <Text style={styles.devLabel}>Código de desarrollo</Text>
                  <Text style={styles.devCode}>{devCode}</Text>
                  <Text style={styles.devHint}>
                    También llega a Mailpit en http://localhost:8025
                  </Text>
                </View>
              ) : null}

              <PrimaryButton label="Verificar" busy={busy} onPress={handleVerify} />

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleResend}
                style={styles.resend}
              >
                <Text style={styles.resendText}>Reenviar código</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStep('start');
                  setCode('');
                  setError(null);
                  setInfo(null);
                }}
                style={styles.resend}
              >
                <Text style={styles.changeData}>Usar otros datos</Text>
              </Pressable>
            </View>
          )}

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

          {step === 'start' && isVendor ? (
            <Text style={styles.hint}>
              Siguiente: nombre de la empresa, sucursales y horarios de atención.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default' }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA8A4"
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9AA8A4"
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.passwordInput}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible((current) => !current)}
          style={styles.showButton}
        >
          <Text style={styles.showText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        busy && styles.buttonBusy,
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  back: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  backText: { color: colors.brand, fontWeight: '600', fontSize: 14 },
  header: { gap: spacing.sm, marginTop: spacing.sm },
  stepText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.muted },
  progress: { flexDirection: 'row', gap: 6, marginVertical: spacing.xs },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  progressDotActive: { backgroundColor: colors.brand },
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingRight: spacing.xs,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  showButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  showText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
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
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  note: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.md },
  noteText: { color: colors.brandDark, fontSize: 13, lineHeight: 19 },
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
  devHint: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xs,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: colors.brandDark },
  buttonBusy: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { alignSelf: 'center', paddingVertical: spacing.sm },
  secondaryText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  resend: { alignSelf: 'center', paddingVertical: spacing.xs },
  resendText: { color: colors.brand, fontWeight: '600', fontSize: 14 },
  changeData: { color: colors.muted, fontSize: 13 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText: { color: colors.muted, fontSize: 13 },
  infoBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.md },
  infoText: { color: colors.brandDark, fontSize: 13, lineHeight: 19 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
