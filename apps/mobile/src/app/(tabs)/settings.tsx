import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/ui/app-text';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Banner } from '../../components/ui/banner';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon, type IconName } from '../../components/ui/icon';
import { Screen } from '../../components/ui/screen';
import { ListRow, Section } from '../../components/ui/section';
import { Skeleton } from '../../components/ui/skeleton';
import { TextField } from '../../components/ui/text-field';
import { ApiError } from '../../lib/api';
import {
  deleteAccount,
  loadCurrentUser,
  signOut,
  updateProfile,
  type PublicUser,
} from '../../lib/auth';
import { clearSession } from '../../lib/token-store';
import { colors, radius, spacing } from '../../theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadCurrentUser()
      .then((current) => {
        if (active) {
          setUser(current);
          setFullName(current.fullName ?? '');
        }
      })
      .catch((caught) => {
        if (!active) {
          return;
        }
        if (caught instanceof ApiError && caught.status === 401) {
          void clearSession().finally(() => router.replace('/'));
          return;
        }
        setLoadError('No pudimos cargar tu cuenta. Revisa tu conexión.');
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave() {
    if (saving) {
      return;
    }
    if (!fullName.trim()) {
      setSaveInfo(null);
      setSaveError('Ingresa tu nombre completo para guardar los cambios.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveInfo(null);
    try {
      const updated = await updateProfile(fullName.trim());
      setUser(updated);
      setSaveInfo('Perfil actualizado.');
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError ? caught.message : 'No pudimos guardar tu perfil.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/');
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos eliminar la cuenta.');
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!user) {
    if (loadError) {
      return (
        <Screen maxWidth={620} contentContainerStyle={styles.loading}>
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos cargar tu cuenta"
            description={loadError}
            actionLabel="Reintentar"
            actionIcon="refresh-outline"
            onAction={() => {
              setLoadError(null);
              loadCurrentUser()
                .then((current) => {
                  setUser(current);
                  setFullName(current.fullName ?? '');
                })
                .catch(() => setLoadError('No pudimos cargar tu cuenta. Revisa tu conexión.'));
            }}
          />
        </Screen>
      );
    }
    return (
      <Screen maxWidth={760} contentContainerStyle={styles.loading}>
        <Skeleton width="100%" height={120} radiusSize={radius.xl} />
        <Skeleton width="100%" height={70} radiusSize={radius.lg} />
        <Skeleton width="100%" height={220} radiusSize={radius.lg} />
      </Screen>
    );
  }

  const isVendor = user.roles.includes('vendor_owner');
  const displayName = user.fullName?.trim() || 'Tu cuenta';
  const phoneVerified = Boolean(user.phoneVerifiedAt);
  const emailVerified = Boolean(user.emailVerifiedAt);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen maxWidth={760} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="micro" color={colors.brand} style={styles.eyebrow}>
          PREFERENCIAS
        </AppText>
        <AppText variant="h1">Tu cuenta</AppText>
        <AppText variant="body" color={colors.muted}>
          Tus datos, tus pedidos y tu negocio en un solo lugar.
        </AppText>
      </View>

      <Card style={styles.profileCard}>
        <View style={styles.profileTop}>
          <Avatar name={user.fullName ?? user.email} size={64} />
          <View style={styles.flex}>
            <AppText variant="h2" numberOfLines={1}>
              {displayName}
            </AppText>
            <AppText variant="caption" color={colors.muted} numberOfLines={1}>
              {user.email}
            </AppText>
          </View>
        </View>
        <View style={styles.chipRow}>
          {user.roles.map((role) => (
            <Badge
              key={role}
              label={role === 'buyer' ? 'Comprador' : role === 'vendor_owner' ? 'Vendedor' : role}
              tone={role === 'buyer' ? 'brand' : 'accent'}
              icon={role === 'buyer' ? 'bag-handle-outline' : 'storefront-outline'}
            />
          ))}
        </View>
      </Card>

      <Section title="Mi actividad">
        <Card variant="outline" padding={16}>
          <MenuRow
            icon="receipt-outline"
            title="Mis pedidos"
            subtitle="Estado, historial y seguimiento"
            onPress={() => router.push('/orders')}
          />
          <MenuRow
            icon="notifications-outline"
            title="Notificaciones"
            subtitle="Pedidos, pagos y mensajes"
            onPress={() => router.push('/notifications')}
          />
          <MenuRow
            icon="stats-chart-outline"
            title="Mis indicadores"
            subtitle="Gasto, pedidos completados y comercios frecuentes"
            onPress={() => router.push('/my-dashboard')}
          />
          <MenuRow
            icon="compass-outline"
            title="Explorar tiendas"
            subtitle="Descubre comercios cerca de ti"
            onPress={() => router.push('/explore')}
            last
          />
        </Card>
      </Section>

      {isVendor ? (
        <Section title="Mi negocio" subtitle="Herramientas para vender">
          <Card variant="outline" padding={16}>
            <MenuRow
              icon="storefront-outline"
              title="Mi negocio"
              subtitle="Empresa, sucursales, horarios y catálogo"
              onPress={() => router.push('/vendor')}
            />
            <MenuRow
              icon="receipt-outline"
              title="Pedidos del negocio"
              subtitle="Gestiona y actualiza el estado"
              onPress={() => router.push('/vendor-orders')}
            />
            <MenuRow
              icon="bar-chart-outline"
              title="Dashboard de ventas"
              subtitle="Consolidado por sucursal y fechas"
              onPress={() => router.push('/vendor-dashboard')}
              last
            />
          </Card>
        </Section>
      ) : (
        <Card variant="plain" style={styles.sellerCard}>
          <View style={styles.sellerIcon}>
            <Icon name="storefront-outline" size={20} color={colors.brand} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Vende en ClubSellBuy</AppText>
            <AppText variant="caption" color={colors.muted}>
              Crea tu empresa y publica tu catálogo sin comisiones.
            </AppText>
          </View>
          <Button
            label="Empezar"
            size="sm"
            variant="soft"
            onPress={() => router.push('/auth?role=vendor')}
          />
        </Card>
      )}

      <Section title="Datos personales">
        <Card variant="outline" padding={16} style={styles.editCard}>
          <TextField
            label="Nombre completo"
            value={fullName}
            onChangeText={setFullName}
            placeholder="¿Cómo te llamas?"
            icon="person-outline"
            autoComplete="name"
          />
          <View style={styles.contactRows}>
            <ContactRow icon="mail-outline" label="Correo" value={user.email} verified={emailVerified} />
            <ContactRow icon="call-outline" label="Celular" value={user.phone} verified={phoneVerified} />
          </View>
          {saveInfo ? <Banner tone="success" message={saveInfo} /> : null}
          {saveError ? <Banner tone="danger" message={saveError} /> : null}
          <Button
            label="Guardar cambios"
            onPress={handleSave}
            loading={saving}
            disabled={saving || deleting || loggingOut || !fullName.trim() || fullName.trim() === (user.fullName ?? '')}
            icon="save-outline"
            size="sm"
          />
        </Card>
      </Section>

      <Section title="Sesión">
        <Card variant="outline" padding={16}>
          <MenuRow
            icon="log-out-outline"
            title={loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            subtitle={loggingOut ? 'Espera un momento' : 'Saldrás de esta cuenta en este dispositivo'}
            onPress={handleLogout}
            last
            tone="neutral"
          />
        </Card>
      </Section>

      <Card variant="outline" style={styles.dangerCard} padding={18}>
        <View style={styles.dangerHeader}>
          <View style={styles.dangerIcon}>
            <Icon name="warning-outline" size={19} color={colors.danger} />
          </View>
          <View style={styles.flex}>
            <AppText variant="h3" color={colors.danger}>
              Eliminar cuenta
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              Se borran tus datos personales, direcciones y dispositivos. No podrás hacerlo si
              tienes pedidos activos.
            </AppText>
          </View>
        </View>
        {confirming ? (
          <View style={styles.dangerActions}>
            <Button
              label={deleting ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
              onPress={handleDelete}
              variant="danger"
              loading={deleting}
              disabled={deleting || saving || loggingOut}
              size="sm"
            />
            <Button
              label="Cancelar"
              onPress={() => setConfirming(false)}
              variant="secondary"
              size="sm"
              disabled={deleting}
            />
          </View>
        ) : (
          <Button
            label="Eliminar mi cuenta"
            onPress={() => setConfirming(true)}
            variant="dangerSoft"
            size="sm"
          />
        )}
        {error ? <Banner tone="danger" message={error} /> : null}
      </Card>

      <View style={styles.footer}>
        <AppText variant="caption" color={colors.subtle} align="center">
          ClubSellBuy v{version} · Hecho para el comercio local
        </AppText>
        <AppText variant="caption" color={colors.subtle} align="center">
          Términos de uso · Política de privacidad
        </AppText>
      </View>
    </Screen>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  last,
  tone = 'brand',
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
  tone?: 'brand' | 'neutral';
}) {
  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      last={last}
      iconTone={tone}
    />
  );
}

function ContactRow({
  icon,
  label,
  value,
  verified,
}: {
  icon: IconName;
  label: string;
  value: string;
  verified: boolean;
}) {
  return (
    <View style={styles.contactRow}>
      <Icon name={icon} size={16} color={colors.muted} />
      <AppText variant="caption" color={colors.muted} style={styles.contactLabel}>
        {label}
      </AppText>
      <AppText variant="caption" numberOfLines={1} style={styles.flex}>
        {value}
      </AppText>
      <Badge
        label={verified ? 'Verificado' : 'Pendiente'}
        tone={verified ? 'success' : 'warning'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingTop: spacing.lg, gap: spacing.md },
  content: { paddingTop: spacing.sm, gap: spacing.lg },
  flex: { flex: 1 },
  header: { gap: 2 },
  eyebrow: { textTransform: 'uppercase' },
  profileCard: { gap: spacing.md },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sellerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCard: { gap: spacing.md },
  contactRows: { gap: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  contactLabel: { width: 52 },
  dangerCard: { gap: spacing.md, borderColor: colors.dangerBorder, backgroundColor: colors.dangerTint },
  dangerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dangerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  footer: { gap: 4, paddingVertical: spacing.md },
});
