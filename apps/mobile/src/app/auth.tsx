import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { AppText } from '../components/ui/app-text';
import { Banner } from '../components/ui/banner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Screen } from '../components/ui/screen';
import { TextField } from '../components/ui/text-field';
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
type Mode = 'signup' | 'login';
type Role = 'buyer' | 'vendor';

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

  const [mode, setMode] = useState<Mode>(params.mode === 'login' ? 'login' : 'signup');
  const [role, setRole] = useState<Role>(params.role === 'vendor' ? 'vendor' : 'buyer');
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
  const [cooldown, setCooldown] = useState(0);

  const isLogin = mode === 'login';
  const isVendor = role === 'vendor';

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const stepNumber = isLogin ? (step === 'start' ? 1 : 2) : step === 'start' ? 1 : step === 'email-code' ? 2 : 3;
  const totalSteps = isLogin ? 2 : 3;

  const titles: Record<Step, string> = {
    start: isLogin ? 'Bienvenido de nuevo' : isVendor ? 'Crea tu cuenta de vendedor' : 'Crea tu cuenta',
    'email-code': 'Verifica tu correo',
    'phone-code': 'Verifica tu celular',
    'login-code': 'Revisa tu correo',
  };

  const subtitles: Record<Step, string> = {
    start: isLogin
      ? 'Entra con tu contraseña o recibe un código por correo.'
      : isVendor
        ? 'Crea tu contraseña y verifica tus datos. Después registrarás tu empresa.'
        : 'Crea tu contraseña y verifica tus datos para empezar a pedir.',
    'email-code': `Ingresa el código de 6 dígitos que enviamos a ${emailForCode}.`,
    'phone-code': `Confirma el código enviado a ${phoneForCode}.`,
    'login-code': `Enviamos un código de 6 dígitos a ${emailForCode}.`,
  };

  function switchMode(next: Mode) {
    setMode(next);
    setStep('start');
    setError(null);
    setInfo(null);
    setCode('');
  }

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
      setCooldown(30);
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
      setCooldown(30);
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
        setCooldown(30);
        setInfo(`Correo verificado. Ahora confirma tu celular ${response.phone}.`);
      } else if (step === 'phone-code' && signupId) {
        await verifySignupPhone(signupId, code);
        router.replace('/home');
      } else if (step === 'login-code') {
        await verifyLoginOtp(
          identifier.trim().includes('@') ? identifier.trim() : toE164(identifier.trim()),
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
    if (cooldown > 0) {
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const destination =
        step === 'phone-code' ? phoneForCode : step === 'login-code' ? emailForCode : emailForCode || email;
      const response = await resendOtp({
        channel: step === 'phone-code' ? 'sms' : 'email',
        destination,
        purpose: step === 'phone-code' ? 'verify_phone' : step === 'login-code' ? 'login' : 'verify_email',
      });
      setDevCode(response.devCode);
      setCooldown(30);
      setInfo('Código reenviado. Revisa tu correo.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} maxWidth={520} contentContainerStyle={styles.content} keyboardAvoiding>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver al inicio"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="arrow-back" size={18} color={colors.text} />
        <AppText variant="label" color={colors.textSoft}>
          Volver
        </AppText>
      </Pressable>

      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Icon name="storefront" size={20} color={colors.onBrand} />
        </View>
        <AppText variant="h3">ClubSellBuy</AppText>
      </View>

      <View style={styles.header}>
        <AppText variant="micro" color={colors.brand} style={styles.stepText}>
          {step === 'start' ? (isLogin ? 'INICIAR SESIÓN' : `PASO ${stepNumber} DE ${totalSteps}`) : `PASO ${stepNumber} DE ${totalSteps}`}
        </AppText>
        <AppText variant="h1">{titles[step]}</AppText>
        <AppText variant="body" color={colors.muted}>
          {subtitles[step]}
        </AppText>
      </View>

      <View style={styles.progress}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={`step-${index}`}
            style={[styles.progressBar, index < stepNumber && styles.progressBarActive]}
          />
        ))}
      </View>

      {step === 'start' && !isLogin ? (
        <View style={styles.roleSwitch}>
          <RolePill
            label="Comprar"
            icon="bag-handle-outline"
            selected={role === 'buyer'}
            onPress={() => setRole('buyer')}
          />
          <RolePill
            label="Vender"
            icon="storefront-outline"
            selected={role === 'vendor'}
            onPress={() => setRole('vendor')}
          />
        </View>
      ) : null}

      {step === 'start' ? (
        <View style={styles.form}>
          {isLogin ? (
            <>
              <TextField
                label="Correo o celular"
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="ana@correo.com o +57 300 123 4567"
                icon="person-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
              />
              <TextField
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                placeholder="Tu contraseña"
                icon="lock-closed-outline"
                secure
                autoComplete="current-password"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/reset-password')}
                style={({ pressed }) => [styles.forgot, pressed && styles.pressed]}
              >
                <AppText variant="caption" color={colors.brand}>
                  ¿Olvidaste tu contraseña?
                </AppText>
              </Pressable>
            </>
          ) : (
            <>
              <TextField
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                placeholder="ana@correo.com"
                icon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <TextField
                label="Celular"
                value={phone}
                onChangeText={setPhone}
                placeholder="+57 300 123 4567"
                icon="call-outline"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
              <TextField
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 8 caracteres"
                icon="lock-closed-outline"
                secure
                autoComplete="new-password"
                hint="Al menos 8 caracteres, con una letra y un número."
              />
              <PasswordStrength password={password} />
              <TextField
                label="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repite tu contraseña"
                icon="lock-closed-outline"
                secure
                autoComplete="new-password"
                error={
                  confirmPassword.length > 0 && confirmPassword !== password
                    ? 'Las contraseñas no coinciden.'
                    : null
                }
              />
            </>
          )}

          {info ? <Banner tone="success" message={info} /> : null}
          {error ? <Banner tone="danger" title="Revisa los datos" message={error} /> : null}

          <Button
            label={isLogin ? 'Entrar' : 'Crear mi cuenta'}
            onPress={handleStart}
            loading={busy}
            disabled={busy}
            fullWidth
            size="lg"
            icon={isLogin ? 'log-in-outline' : 'arrow-forward'}
          />

          {isLogin ? (
            <Button
              label="Entrar con un código por correo"
              onPress={handleStartOtp}
              disabled={busy}
              variant="secondary"
              fullWidth
              icon="mail-unread-outline"
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.otpWrap}>
            <AppText variant="label" color={colors.textSoft}>
              Código de 6 dígitos
            </AppText>
            <OtpInput value={code} onChange={setCode} />
          </View>

          {__DEV__ && devCode ? (
            <Card variant="plain" style={styles.devBox} padding={14}>
              <View style={styles.devHeader}>
                <Icon name="code-slash-outline" size={16} color={colors.brandDark} />
                <AppText variant="micro" color={colors.brandDark}>
                  CÓDIGO DE DESARROLLO
                </AppText>
              </View>
              <AppText variant="h1" color={colors.brandDark} style={styles.devCode}>
                {devCode}
              </AppText>
              <AppText variant="caption" color={colors.muted} align="center">
                También llega a Mailpit en http://localhost:8025
              </AppText>
            </Card>
          ) : null}

          {info ? <Banner tone="success" message={info} /> : null}
          {error ? <Banner tone="danger" title="Revisa los datos" message={error} /> : null}

          <Button
            label="Verificar código"
            onPress={handleVerify}
            loading={busy}
            disabled={busy || code.length !== 6}
            fullWidth
            size="lg"
            icon="checkmark-circle-outline"
          />

          <View style={styles.resendRow}>
            <AppText variant="caption" color={colors.muted}>
              ¿No recibiste el código?
            </AppText>
            <Pressable
              accessibilityRole="button"
              disabled={busy || cooldown > 0}
              onPress={handleResend}
              style={({ pressed }) => [styles.resendButton, pressed && styles.pressed]}
            >
              <AppText
                variant="caption"
                color={cooldown > 0 ? colors.subtle : colors.brand}
                style={styles.resendText}
              >
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
              </AppText>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStep('start');
              setCode('');
              setError(null);
              setInfo(null);
              setCooldown(0);
            }}
            style={({ pressed }) => [styles.changeData, pressed && styles.pressed]}
          >
            <Icon name="create-outline" size={14} color={colors.muted} />
            <AppText variant="caption" color={colors.muted}>
              Usar otros datos
            </AppText>
          </Pressable>
        </View>
      )}

      {step === 'start' ? (
        <View style={styles.switchRow}>
          <AppText variant="caption" color={colors.muted}>
            {isLogin ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => switchMode(isLogin ? 'signup' : 'login')}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <AppText variant="caption" color={colors.brand} style={styles.switchLink}>
              {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {step === 'start' && isVendor ? (
        <Card variant="plain" style={styles.vendorHint} padding={14}>
          <Icon name="storefront-outline" size={18} color={colors.brand} />
          <AppText variant="caption" color={colors.textSoft} style={styles.flex}>
            Siguiente paso: nombre de la empresa, sucursales y horarios de atención.
          </AppText>
        </Card>
      ) : null}

      <AppText variant="caption" color={colors.subtle} align="center" style={styles.legal}>
        Al continuar aceptas los términos de uso y la política de privacidad de ClubSellBuy.
      </AppText>
    </Screen>
  );
}

function RolePill({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: 'bag-handle-outline' | 'storefront-outline';
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.rolePill, selected && styles.rolePillSelected, pressed && styles.pressed]}
    >
      <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
        <Icon name={icon} size={18} color={selected ? colors.brand : colors.muted} />
      </View>
      <AppText variant="label" color={selected ? colors.brandDark : colors.muted}>
        {label}
      </AppText>
    </Pressable>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return null;
  }
  const checks = [password.length >= 8, /[A-Za-z]/.test(password), /\d/.test(password)];
  const score = checks.filter(Boolean).length;
  return (
    <View style={styles.strengthRow}>
      {[0, 1, 2].map((index) => (
        <View
          key={`strength-${index}`}
          style={[
            styles.strengthBar,
            index < score && (score < 2 ? styles.strengthWeak : score < 3 ? styles.strengthMid : styles.strengthStrong),
          ]}
        />
      ))}
      <AppText variant="caption" color={colors.muted}>
        {score < 2 ? 'Contraseña débil' : score < 3 ? 'Casi lista' : 'Contraseña segura'}
      </AppText>
    </View>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputs = useRef<(TextInputInstance | null)[]>([]);
  const [focused, setFocused] = useState(0);

  return (
    <View style={styles.otpRow}>
      {Array.from({ length: 6 }).map((_, index) => (
        <TextInput
          key={`otp-${index}`}
          ref={(node) => {
            inputs.current[index] = node;
          }}
          value={value[index] ?? ''}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '');
            if (!digits) {
              onChange(value.slice(0, index));
              return;
            }
            const next = value.split('');
            digits
              .slice(0, 6 - index)
              .split('')
              .forEach((digit, offset) => {
                next[index + offset] = digit;
              });
            const joined = next.join('').slice(0, 6);
            onChange(joined);
            const target = Math.min(index + digits.length, 5);
            inputs.current[target]?.focus();
            setFocused(target);
          }}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
              inputs.current[index - 1]?.focus();
              onChange(value.slice(0, index - 1));
            }
          }}
          onFocus={() => setFocused(index)}
          accessibilityLabel={`Dígito ${index + 1} de 6`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus={index === 0}
          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
          style={[styles.otpCell, focused === index && styles.otpCellFocused, value[index] && styles.otpCellFilled]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xxl },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { gap: spacing.xs, marginTop: spacing.xs },
  stepText: { textTransform: 'uppercase', letterSpacing: 0.7 },
  progress: { flexDirection: 'row', gap: 6 },
  progressBar: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  progressBarActive: { backgroundColor: colors.brand },
  roleSwitch: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.lg,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    borderRadius: radius.md,
  },
  rolePillSelected: { backgroundColor: colors.surface },
  roleIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: { backgroundColor: colors.brandTint },
  form: { gap: spacing.md },
  forgot: { alignSelf: 'flex-end', marginTop: -4 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4 },
  strengthBar: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  strengthWeak: { backgroundColor: colors.danger },
  strengthMid: { backgroundColor: colors.accent },
  strengthStrong: { backgroundColor: colors.success },
  otpWrap: { gap: spacing.sm },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  otpCell: {
    flex: 1,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  otpCellFocused: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  otpCellFilled: { borderColor: colors.brandSoft },
  devBox: { alignItems: 'center', gap: 4, backgroundColor: colors.brandTint },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  devCode: { letterSpacing: 7, fontSize: 30, lineHeight: 38 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  resendButton: { paddingVertical: 4 },
  resendText: { fontWeight: '700' },
  changeData: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  switchLink: { fontWeight: '800' },
  vendorHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legal: { marginTop: spacing.sm },
});
