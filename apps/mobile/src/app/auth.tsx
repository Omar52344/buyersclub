import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { colors, radius, spacing } from '../theme';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; mode?: string }>();
  const isVendor = params.role === 'vendor';
  const isLogin = params.mode === 'login';

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const title = isLogin
    ? 'Iniciar sesión'
    : isVendor
      ? 'Crea tu cuenta de vendedor'
      : 'Crea tu cuenta de comprador';

  const subtitle = isLogin
    ? 'Te enviaremos un código de 6 dígitos. Sin contraseñas.'
    : isVendor
      ? 'Primero verificamos tus datos. Después crearás tu empresa, sucursales y catálogo.'
      : 'Verifica tu correo y tu celular para empezar a pedir.';

  function handleSubmit() {
    if (isLogin) {
      if (identifier.trim().length < 5) {
        setMessage('Ingresa tu correo o tu número de celular.');
        return;
      }
      setMessage('Listo. El envío de códigos se conecta en el siguiente paso de la Fase 1.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage('Ingresa un correo válido.');
      return;
    }

    if (!/^\+?[\d\s-]{8,18}$/.test(phone.trim())) {
      setMessage('Ingresa tu celular con el indicativo, por ejemplo +57 300 123 4567.');
      return;
    }

    setMessage('Datos válidos. La API de códigos OTP se conecta en el siguiente paso de la Fase 1.');
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
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Text style={styles.backText}>← Volver</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.phase}>Fase 1 · Fundaciones</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.form}>
            {isLogin ? (
              <Field
                label="Correo o celular"
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="ana@correo.com o +57 300 123 4567"
                keyboardType="email-address"
              />
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
              </>
            )}

            {!isLogin && (
              <View style={styles.note}>
                <Text style={styles.noteText}>
                  Verificaremos el correo con un código. El celular quedará registrado y la
                  verificación por SMS se activará en una fase posterior.
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={handleSubmit}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>
                {isLogin ? 'Enviar código' : 'Continuar'}
              </Text>
            </Pressable>

            {message && (
              <View style={styles.message}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            )}

            {!isLogin && isVendor && (
              <Text style={styles.hint}>
                Siguiente: nombre de la empresa, sucursales y horarios de atención.
              </Text>
            )}
          </View>
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.brand,
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  phase: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
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
  note: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noteText: {
    color: colors.brandDark,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonPressed: {
    backgroundColor: colors.brandDark,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  message: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  messageText: {
    color: '#92400E',
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
