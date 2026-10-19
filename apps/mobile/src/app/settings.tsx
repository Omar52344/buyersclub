import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  deleteAccount,
  loadCurrentUser,
  signOut,
  updateProfile,
  type PublicUser,
} from '../lib/auth';
import { colors, radius, spacing } from '../theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadCurrentUser()
      .then((current) => {
        if (active) {
          setUser(current);
          setFullName(current.fullName ?? '');
        }
      })
      .catch(() => {
        if (active) {
          router.replace('/');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const updated = await updateProfile(fullName.trim());
      setUser(updated);
      setInfo('Perfil actualizado.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar tu perfil.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    await signOut();
    router.replace('/');
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      router.replace('/');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'No pudimos eliminar la cuenta.',
      );
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Cargando tu cuenta…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Cuenta y ajustes</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos de contacto</Text>
          <Text style={styles.muted}>Correo: {user.email}</Text>
          <Text style={styles.muted}>Celular: {user.phone}</Text>
          <Text style={styles.muted}>Roles: {user.roles.join(', ')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tu nombre</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre"
            placeholderTextColor="#9AA8A4"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={handleSave}
            style={[styles.primary, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Guardar cambios</Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sesión</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={handleLogout}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Cerrar sesión</Text>
          </Pressable>
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Eliminar cuenta</Text>
          <Text style={styles.muted}>
            Se borran tus datos personales, direcciones y dispositivos. No puedes eliminar la
            cuenta si tienes pedidos activos. Los pedidos históricos se conservan sin tus datos
            personales.
          </Text>
          {confirming ? (
            <View style={styles.dangerActions}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleDelete}
                style={[styles.dangerButton, busy && styles.disabled]}
              >
                <Text style={styles.dangerButtonText}>Sí, eliminar mi cuenta</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirming(false)}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirming(true)}
              style={styles.dangerOutline}
            >
              <Text style={styles.dangerOutlineText}>Eliminar mi cuenta</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  spacer: { width: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  infoBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.md },
  infoText: { color: colors.brandDark, fontSize: 13 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  dangerCard: {
    backgroundColor: '#FFF7F7',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dangerTitle: { fontSize: 16, fontWeight: '800', color: colors.danger },
  dangerActions: { gap: spacing.sm },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  dangerOutline: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerOutlineText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
});
