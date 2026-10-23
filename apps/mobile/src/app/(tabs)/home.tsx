import { formatMoney } from '@buyersclub/core';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBadge } from '../../components/status-badge';
import { AppText } from '../../components/ui/app-text';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Banner } from '../../components/ui/banner';
import { Button, IconButton } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { Screen } from '../../components/ui/screen';
import { Section } from '../../components/ui/section';
import { Skeleton, SkeletonCard } from '../../components/ui/skeleton';
import { ApiError } from '../../lib/api';
import { findNearby, type CurrencyCode, type NearbyBranch } from '../../lib/discovery';
import { distanceLabel, firstNameOf, isActiveOrder, relativeTime, timeLabel } from '../../lib/format';
import { loadCurrentUser, type PublicUser } from '../../lib/auth';
import { listNotifications } from '../../lib/notifications';
import { getOrders, type OrderSummary } from '../../lib/orders';
import { registerForPush } from '../../lib/push';
import { useResponsive } from '../../lib/responsive';
import { clearSession } from '../../lib/token-store';
import { colors, radius, spacing, webCursor } from '../../theme';

const DEFAULT_LOCATION = { lat: 4.6486, lng: -74.0628 };
const ACTIVE_STATUSES = ['pending', 'awaiting_payment', 'accepted', 'preparing', 'ready', 'out_for_delivery'];

export default function HomeScreen() {
  const router = useRouter();
  const { isTablet } = useResponsive();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [nearby, setNearby] = useState<NearbyBranch[]>([]);
  const [unread, setUnread] = useState(0);
  const [locationLabel, setLocationLabel] = useState('Bogotá');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    let current: PublicUser;
    try {
      current = await loadCurrentUser();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await clearSession();
        router.replace('/');
        return;
      }
      setError('No pudimos cargar tu inicio. Revisa tu conexión e inténtalo otra vez.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setUser(current);
    void registerForPush().catch(() => undefined);

    try {
      const permission = await Location.getForegroundPermissionsAsync();
      let position = DEFAULT_LOCATION;
      if (permission.status === 'granted') {
        try {
          const currentPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          position = {
            lat: currentPosition.coords.latitude,
            lng: currentPosition.coords.longitude,
          };
          setLocationLabel('Tu ubicación');
        } catch {
          // Si falla el GPS seguimos con la zona por defecto.
        }
      }

      const list = await findNearby({
        lat: position.lat,
        lng: position.lng,
        radius: 7000,
        limit: 8,
      });
      setNearby(list);
    } catch {
      setError('No pudimos actualizar tu inicio. Revisa tu conexión e inténtalo otra vez.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Al volver a Inicio refrescamos pedidos y avisos sin repetir GPS ni geocodificación.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.allSettled([getOrders(), listNotifications(true)]).then(
        ([orderList, notificationList]) => {
          if (!active) {
            return;
          }
          if (orderList.status === 'fulfilled') {
            setOrders(orderList.value);
          }
          if (notificationList.status === 'fulfilled') {
            setUnread(notificationList.value.length);
          }
        },
      );
      return () => {
        active = false;
      };
    }, []),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  if (!user) {
    if (error) {
      return (
        <Screen maxWidth={620} contentContainerStyle={styles.loadingWrap}>
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos cargar tu inicio"
            description={error}
            actionLabel="Reintentar"
            actionIcon="refresh-outline"
            onAction={() => {
              setLoading(true);
              void load();
            }}
          />
        </Screen>
      );
    }
    return (
      <Screen maxWidth={880} contentContainerStyle={styles.loadingWrap}>
        <Skeleton width="45%" height={16} />
        <Skeleton width="70%" height={30} />
        <Skeleton width="100%" height={90} radiusSize={20} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  const firstName = firstNameOf(user.fullName);
  const activeOrder = orders.find((order) => isActiveOrder(order.status));
  const recentOrder = orders[0];
  const isVendor = user.roles.includes('vendor_owner');
  const needsProfile = !user.fullName?.trim() || !user.phoneVerifiedAt;

  return (
    <Screen
      maxWidth={980}
      contentContainerStyle={styles.content}
      bottomInset={spacing.lg}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
      <View style={styles.topBar}>
        <View style={styles.identity}>
          <Avatar name={user.fullName ?? user.email} size={46} />
          <View style={styles.identityText}>
            <AppText variant="caption" color={colors.muted}>
              {greeting()}
            </AppText>
            <AppText variant="h2" numberOfLines={1}>
              {firstName ?? 'Bienvenido'}
            </AppText>
          </View>
        </View>
        <View style={styles.topActions}>
          <IconButton
            icon="notifications-outline"
            label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
            badge={unread}
            onPress={() => router.push('/notifications')}
          />
          <IconButton
            icon="settings-outline"
            label="Cuenta y ajustes"
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Buscar tiendas o productos"
        onPress={() => router.push('/explore')}
        style={({ pressed }) => [styles.locationRow, pressed && styles.pressed, webCursor]}
      >
        <View style={styles.locationIcon}>
          <Icon name="location" size={16} color={colors.brand} />
        </View>
        <View style={styles.locationText}>
          <AppText variant="caption" color={colors.muted}>
            Comprando en
          </AppText>
          <AppText variant="label" numberOfLines={1}>
            {locationLabel} · Toca para buscar
          </AppText>
        </View>
        <Icon name="chevron-forward" size={16} color={colors.subtle} />
      </Pressable>

      {error ? <Banner tone="warning" message={error} /> : null}

      {needsProfile ? (
        <Banner
          tone="warning"
          title="Completa tu perfil"
          message={
            !user.fullName?.trim()
              ? 'Agrega tu nombre para que las tiendas sepan quién recibe el pedido.'
              : 'Verifica tu celular para agilizar la entrega de tus pedidos.'
          }
          actionLabel="Completar perfil"
          onAction={() => router.push('/settings')}
        />
      ) : null}

      {activeOrder ? (
        <ActiveOrderCard
          order={activeOrder}
          onPress={() => router.push({ pathname: '/order', params: { id: activeOrder.id } })}
        />
      ) : (
        <Card variant="brand" padding={22} style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Icon name="sparkles" size={14} color={colors.accent} />
            <AppText variant="micro" color={colors.brandSoft}>
              TODO CERCA, EN UN SOLO LUGAR
            </AppText>
          </View>
          <AppText variant="h2" color={colors.onBrand}>
            ¿Qué se te antoja hoy?
          </AppText>
          <AppText variant="body" color={colors.onBrandMuted}>
            Descubre lo que tienen las tiendas de tu zona y pide a domicilio o para recoger.
          </AppText>
          <Button
            label="Ver tiendas cerca"
            icon="compass-outline"
            variant="secondary"
            onPress={() => router.push('/explore')}
            style={styles.heroButton}
          />
        </Card>
      )}

      <Section
        title="Cerca de ti"
        subtitle={`Comercios a menos de 7 km · ${locationLabel}`}
        actionLabel="Ver todos"
        onAction={() => router.push('/explore')}
      >
        {loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {[0, 1, 2].map((index) => (
              <View key={`nearby-skeleton-${index}`} style={styles.nearbySkeleton}>
                <Skeleton width="100%" height={150} radiusSize={radius.lg} />
              </View>
            ))}
          </ScrollView>
        ) : nearby.length === 0 ? (
          <EmptyState
            compact
            icon={error ? 'cloud-offline-outline' : 'storefront-outline'}
            title={error ? 'No pudimos cargar las tiendas' : 'Aún no hay tiendas en tu zona'}
            description={
              error
                ? 'Revisa tu conexión y vuelve a intentarlo.'
                : 'Cuando los vendedores cercanos publiquen su catálogo, aparecerán aquí.'
            }
            actionLabel={error ? 'Reintentar' : 'Ampliar búsqueda'}
            onAction={() => {
              if (error) {
                void handleRefresh();
              } else {
                router.push('/explore');
              }
            }}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {nearby.map((branch) => (
              <NearbyCard
                key={branch.id}
                branch={branch}
                onPress={() => router.push({ pathname: '/store', params: { id: branch.id } })}
              />
            ))}
          </ScrollView>
        )}
      </Section>

      {recentOrder && !activeOrder ? (
        <Section
          title="Tu último pedido"
          actionLabel="Ver historial"
          onAction={() => router.push('/orders')}
        >
          <Card
            onPress={() => router.push({ pathname: '/order', params: { id: recentOrder.id } })}
            accessibilityLabel={`Pedido ${recentOrder.code}`}
            style={styles.lastOrder}
          >
            <View style={styles.lastOrderRow}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{recentOrder.businessName}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {recentOrder.code} · {relativeTime(recentOrder.createdAt)}
                </AppText>
              </View>
              <StatusBadge status={recentOrder.status} />
            </View>
            <View style={styles.lastOrderRow}>
              <AppText variant="caption" color={colors.muted}>
                {recentOrder.itemCount} {recentOrder.itemCount === 1 ? 'ítem' : 'ítems'} ·{' '}
                {recentOrder.fulfillment === 'delivery' ? 'Domicilio' : 'Recogida'}
              </AppText>
              <AppText variant="bodyStrong">
                {money(recentOrder.totalCents, recentOrder.currency)}
              </AppText>
            </View>
          </Card>
        </Section>
      ) : null}

      {isVendor ? (
        <Section title="Tu negocio" subtitle="Gestiona tu operación desde aquí">
          <Card variant="outline" style={styles.vendorCard}>
            <View style={styles.vendorHeader}>
              <View style={styles.vendorIcon}>
                <Icon name="briefcase-outline" size={20} color={colors.accentDark} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Panel de vendedor</AppText>
                <AppText variant="caption" color={colors.muted}>
                  Catálogo, pedidos y ventas en un mismo lugar
                </AppText>
              </View>
            </View>
            <View style={[styles.vendorActions, isTablet && styles.vendorActionsWide]}>
              <Button
                label="Mi negocio"
                icon="storefront-outline"
                variant="soft"
                size="sm"
                onPress={() => router.push('/vendor')}
              />
              <Button
                label="Pedidos"
                icon="receipt-outline"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/vendor-orders')}
              />
              <Button
                label="Ventas"
                icon="stats-chart-outline"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/vendor-dashboard')}
              />
            </View>
          </Card>
        </Section>
      ) : null}

      {!isVendor ? (
        <Card variant="plain" style={styles.sellerPrompt}>
          <View style={styles.sellerIcon}>
            <Icon name="storefront-outline" size={20} color={colors.brand} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">¿Tienes un negocio?</AppText>
            <AppText variant="caption" color={colors.muted}>
              Publica tu catálogo y recibe pedidos de tus vecinos.
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/auth?role=vendor')}
            style={({ pressed }) => [styles.sellerLink, pressed && styles.pressed, webCursor]}
          >
            <AppText variant="label" color={colors.brand}>
              Empezar
            </AppText>
            <Icon name="arrow-forward" size={14} color={colors.brand} />
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.footer}>
        <AppText variant="caption" color={colors.subtle} align="center">
          ClubSellBuy · Comercio local, sin comisiones
        </AppText>
      </View>
    </Screen>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Buenos días';
  }
  if (hour < 19) {
    return 'Buenas tardes';
  }
  return 'Buenas noches';
}

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

function ActiveOrderCard({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  const progress = (ACTIVE_STATUSES.indexOf(order.status) + 1) / ACTIVE_STATUSES.length;
  return (
    <Card onPress={onPress} style={styles.activeCard} accessibilityLabel={`Pedido en curso ${order.code}`}>
      <View style={styles.activeHeader}>
        <View style={styles.activeIcon}>
          <Icon
            name={order.fulfillment === 'delivery' ? 'bicycle' : 'bag-handle'}
            size={20}
            color={colors.onBrand}
          />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.muted}>
            Pedido en curso · {order.code}
          </AppText>
          <AppText variant="h3" numberOfLines={1}>
            {order.businessName}
          </AppText>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 12)}%` }]} />
      </View>

      <View style={styles.activeFooter}>
        <AppText variant="caption" color={colors.muted}>
          {order.etaAt
            ? order.fulfillment === 'delivery'
              ? `Llega aprox. a las ${timeLabel(order.etaAt)}`
              : `Listo aprox. a las ${timeLabel(order.etaAt)}`
            : 'Revisa el estado del pedido'}
        </AppText>
        <View style={styles.activeCta}>
          <AppText variant="label" color={colors.brand}>
            Seguir pedido
          </AppText>
          <Icon name="arrow-forward" size={15} color={colors.brand} />
        </View>
      </View>
    </Card>
  );
}

function NearbyCard({ branch, onPress }: { branch: NearbyBranch; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${branch.name}, ${branch.isOpen ? 'abierta' : 'cerrada'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.nearbyCard, pressed && styles.quickPressed, webCursor]}
    >
      <View style={styles.nearbyTop}>
        <View style={styles.nearbyIcon}>
          <Icon name="storefront-outline" size={20} color={colors.brand} />
        </View>
        <Badge
          label={branch.isOpen ? 'Abierta' : 'Cerrada'}
          tone={branch.isOpen ? 'success' : 'danger'}
          dot
        />
      </View>
      <AppText variant="h3" numberOfLines={1}>
        {branch.name}
      </AppText>
      <AppText variant="caption" color={colors.muted} numberOfLines={1}>
        {branch.business.name}
      </AppText>
      <View style={styles.nearbyMeta}>
        <Icon name="navigate-outline" size={13} color={colors.muted} />
        <AppText variant="caption" color={colors.muted}>
          {distanceLabel(branch.distanceMeters)}
        </AppText>
        {branch.fulfillment.delivery ? (
          <>
            <View style={styles.metaDot} />
            <AppText variant="caption" color={colors.muted}>
              Domicilio
            </AppText>
          </>
        ) : null}
      </View>
      {branch.productPreview.length > 0 ? (
        <AppText variant="caption" color={colors.textSoft} numberOfLines={1}>
          {branch.productPreview
            .slice(0, 2)
            .map((product) => product.name)
            .join(' · ')}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { paddingTop: spacing.xl, gap: spacing.md },
  content: { paddingTop: spacing.sm, gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  identityText: { flex: 1, gap: 0 },
  topActions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  locationIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { flex: 1, gap: 0 },
  pressed: { opacity: 0.7 },
  heroCard: { gap: spacing.sm },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  heroButton: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  activeCard: { gap: 12 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activeIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand },
  activeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  activeCta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  quickPressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  carousel: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.md },
  nearbySkeleton: { width: 230 },
  nearbyCard: {
    width: 232,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 3,
  },
  nearbyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  nearbyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, marginBottom: 2 },
  metaDot: { width: 3, height: 3, borderRadius: radius.pill, backgroundColor: colors.subtle, marginHorizontal: 2 },
  lastOrder: { gap: 8 },
  lastOrderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  vendorCard: { gap: spacing.md },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vendorActionsWide: { flexWrap: 'nowrap' },
  sellerPrompt: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sellerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerLink: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 4 },
  footer: { paddingVertical: spacing.md },
});
