import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../components/ui/app-text';
import { Banner } from '../components/ui/banner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Screen } from '../components/ui/screen';
import { TextField } from '../components/ui/text-field';
import { ApiError } from '../lib/api';
import { requestPasswordReset, resetPassword } from '../lib/auth';
import { clearSession } from '../lib/token-store';
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
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

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
      setCooldown(30);
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
      await clearSession();
      setStep('done');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await requestPasswordReset(email.trim());
      setDevCode(response.devCode);
      setInfo('Enviamos un código nuevo. Revisa tu correo.');
      setCooldown(30);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done') {
    return (
      <Screen edges={['top', 'bottom']} maxWidth={520} contentContainerStyle={styles.content}>
        <Card style={styles.doneCard}>
          <View style={styles.doneIcon}>
            <Icon name="checkmark-circle" size={38} color={colors.success} />
          </View>
          <AppText variant="h1" align="center">
            Contraseña actualizada
          </AppText>
          <AppText variant="body" color={colors.muted} align="center">
            Cerramos las sesiones abiertas por seguridad. Ya puedes entrar con tu nueva contraseña.
          </AppText>
          <Button
            label="Iniciar sesión"
            onPress={() => router.replace('/auth?mode=login')}
            fullWidth
            size="lg"
            icon="log-in-outline"
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} maxWidth={520} contentContainerStyle={styles.content} keyboardAvoiding>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={() =>
          step === 'email'
            ? router.canGoBack()
              ? router.back()
              : router.replace('/auth?mode=login')
            : setStep('email')
        }
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="arrow-back" size={18} color={colors.text} />
        <AppText variant="label" color={colors.textSoft}>
          Volver
        </AppText>
      </Pressable>

      <View style={styles.header}>
        <AppText variant="micro" color={colors.brand} style={styles.eyebrow}>
          RECUPERAR ACCESO
        </AppText>
        <AppText variant="h1">
          {step === 'email' ? '¿Olvidaste tu contraseña?' : 'Crea una nueva contraseña'}
        </AppText>
        <AppText variant="body" color={colors.muted}>
          {step === 'email'
            ? 'Escribe el correo de tu cuenta y te enviaremos un código de recuperación.'
            : `Ingresa el código enviado a ${email.trim()} y define tu nueva contraseña.`}
        </AppText>
      </View>

      {info ? <Banner tone="success" message={info} /> : null}
      {error ? <Banner tone="danger" title="Revisa los datos" message={error} /> : null}

      <View style={styles.form}>
        {step === 'email' ? (
          <TextField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="ana@correo.com"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        ) : (
          <>
            <TextField
              label="Código de 6 dígitos"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              icon="keypad-outline"
              keyboardType="number-pad"
              maxLength={6}
              hint="Revisa tu correo, incluida la carpeta de spam."
            />
            <Button
              label={cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
              onPress={handleResend}
              variant="ghost"
              size="sm"
              disabled={cooldown > 0 || busy}
              icon="refresh-outline"
            />

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
                <AppText variant="caption" color={colors.muted}>
                  También llega a Mailpit (localhost:8025)
                </AppText>
              </Card>
            ) : null}

            <TextField
              label="Nueva contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              icon="lock-closed-outline"
              secure
              autoComplete="new-password"
              hint="Al menos 8 caracteres, con una letra y un número."
            />
            <TextField
              label="Confirmar contraseña"
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder="Repite la contraseña"
              icon="lock-closed-outline"
              secure
              autoComplete="new-password"
              error={
                confirmation.length > 0 && confirmation !== password
                  ? 'Las contraseñas no coinciden.'
                  : null
              }
            />
          </>
        )}

        <Button
          label={step === 'email' ? 'Enviar código' : 'Cambiar contraseña'}
          onPress={step === 'email' ? handleRequest : handleReset}
          loading={busy}
          disabled={busy}
          fullWidth
          size="lg"
          icon={step === 'email' ? 'paper-plane-outline' : 'shield-checkmark-outline'}
        />
      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.sm, gap: spacing.lg, paddingBottom: spacing.xxl },
  pressed: { opacity: 0.7 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4 },
  header: { gap: spacing.xs },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.7 },
  form: { gap: spacing.md },
  devBox: { alignItems: 'center', gap: 4, backgroundColor: colors.brandTint },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  devCode: { letterSpacing: 7, fontSize: 30, lineHeight: 38 },
  doneCard: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, marginTop: spacing.xl },
  doneIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
