import { formatMoney } from '@buyersclub/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { BranchMap } from '../components/branch-map';
import { AppText } from '../components/ui/app-text';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Banner } from '../components/ui/banner';
import { Button, IconButton } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Icon } from '../components/ui/icon';
import { QuantityStepper } from '../components/ui/quantity-stepper';
import { Screen } from '../components/ui/screen';
import { Skeleton } from '../components/ui/skeleton';
import { TextField } from '../components/ui/text-field';
import { TopBar } from '../components/ui/header';
import { ApiError } from '../lib/api';
import { useCart } from '../lib/cart';
import { getPublicBranch, type CurrencyCode, type PublicBranch } from '../lib/discovery';
import { useResponsive } from '../lib/responsive';
import { colors, radius, spacing } from '../theme';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

export default function StoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const { isTablet } = useResponsive();

  const [branch, setBranch] = useState<PublicBranch | null>(null);
  const { cart, itemCount, subtotalCents, addItem, setQty } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }
    let active = true;
    getPublicBranch(id)
      .then((value) => {
        if (active) {
          setBranch(value);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar la tienda.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const schedule = useMemo(() => {
    if (!branch) {
      return [];
    }
    return [0, 1, 2, 3, 4, 5, 6]
      .map((day) => ({
        day,
        ranges: branch.hours
          .filter((hour) => hour.weekday === day && !hour.isClosed)
          .map((hour) => `${hour.opensAt.slice(0, 5)}–${hour.closesAt.slice(0, 5)}`),
      }));
  }, [branch]);

  const products = useMemo(() => {
    if (!branch) {
      return [];
    }
    const term = productQuery.trim().toLowerCase();
    if (!term) {
      return branch.products;
    }
    return branch.products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.description ?? '').toLowerCase().includes(term),
    );
  }, [branch, productQuery]);

  const mapBranches = useMemo(
    () =>
      branch
        ? [
            {
              id: branch.id,
              name: branch.name,
              lat: branch.location.lat,
              lng: branch.location.lng,
              isOpen: branch.isOpen,
            },
          ]
        : [],
    [branch],
  );

  if (loading && id) {
    return (
      <Screen edges={['top', 'bottom']} maxWidth={760} contentContainerStyle={styles.loading}>
        <TopBar title="Tienda" />
        <Skeleton width="40%" height={20} />
        <Skeleton width="100%" height={150} radiusSize={radius.lg} />
        <Skeleton width="100%" height={90} radiusSize={radius.lg} />
        <Skeleton width="100%" height={70} radiusSize={radius.md} />
        <Skeleton width="100%" height={70} radiusSize={radius.md} />
      </Screen>
    );
  }

  if (!branch) {
    return (
      <Screen edges={['top', 'bottom']} maxWidth={560}>
        <TopBar title="Tienda" />
        <EmptyState
          icon="storefront-outline"
          title="No pudimos abrir esta tienda"
          description={
            error ?? (id ? 'Puede que ya no esté disponible.' : 'No encontramos esta tienda.')
          }
          actionLabel="Volver al inicio"
          actionIcon="home-outline"
          onAction={() => router.replace('/home')}
        />
      </Screen>
    );
  }

  const today = new Date().getDay();
  const todayHours = schedule.find((entry) => entry.day === today);
  const otherHours = schedule.filter((entry) => entry.day !== today);
  const hasHours = branch.hours.length > 0;
  const hasDelivery = branch.fulfillment.delivery;
  const hasOtherCart = Boolean(cart && cart.items.length > 0 && cart.branchId !== branch.id);
  const days = DAY_NAMES;

  function changeQty(productId: string, quantity: number) {
    if (!branch) {
      return;
    }
    if (quantity <= 0) {
      setQty(productId, 0);
      return;
    }
    const existing = cart?.items.find((item) => item.productId === productId);
    if (!existing) {
      const product = branch.products.find((item) => item.id === productId);
      if (!product) {
        return;
      }
      addItem(
        {
          branchId: branch.id,
          branchName: branch.name,
          businessName: branch.business.name,
          currency: branch.business.currency,
          fulfillment: branch.fulfillment,
          deliveryFeeCents: branch.deliveryFee.amountCents,
          minOrderCents: branch.minOrder.amountCents,
        },
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.priceCents,
          qty: quantity,
          stock: product.stock,
        },
      );
      return;
    }
    setQty(productId, quantity);
  }

  return (
    <Screen
      edges={['top', 'bottom']}
      maxWidth={820}
      contentContainerStyle={styles.content}
      bottomInset={spacing.xl}
      footer={
        itemCount > 0 ? (
          <View style={styles.footerBar}>
            <View style={styles.footerText}>
              <AppText variant="caption" color={colors.muted}>
                {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                {hasOtherCart && cart ? ` · ${cart.businessName}` : ''}
              </AppText>
              <AppText variant="h3">
                {money(subtotalCents, cart?.currency ?? branch.business.currency)}
              </AppText>
            </View>
            <Button
              label="Ver carrito"
              iconRight="arrow-forward"
              onPress={() => router.push('/cart')}
            />
          </View>
        ) : undefined
      }
    >
      <TopBar
        title="Tienda"
        right={
          <IconButton
            icon="bag-handle-outline"
            label={`Carrito, ${itemCount} ${itemCount === 1 ? 'ítem' : 'ítems'}`}
            badge={itemCount}
            onPress={() => router.push('/cart')}
          />
        }
      />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Avatar name={branch.business.name} size={58} square />
          <View style={styles.heroText}>
            <AppText variant="caption" color={colors.brandSoft}>
              {branch.category?.name ?? 'Comercio local'}
            </AppText>
            <AppText variant="h1" color={colors.onBrand} numberOfLines={2}>
              {branch.business.name}
            </AppText>
            <AppText variant="body" color={colors.onBrandMuted} numberOfLines={1}>
              {branch.name}
            </AppText>
          </View>
        </View>

        <View style={styles.heroBadges}>
          <Badge
            label={branch.isOpen ? 'Abierta ahora' : 'Cerrada'}
            tone={branch.isOpen ? 'success' : 'danger'}
            dot
          />
          {branch.fulfillment.delivery ? (
            <Badge label="Domicilio" tone="neutral" icon="bicycle-outline" />
          ) : null}
          {branch.fulfillment.pickup ? (
            <Badge label="Recogida" tone="neutral" icon="walk-outline" />
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Llamar a ${branch.business.name}`}
          disabled={!branch.phone}
          onPress={() => {
            if (branch.phone) {
              void Linking.openURL(`tel:${branch.phone.replace(/\s/g, '')}`);
            }
          }}
          style={({ pressed }) => [styles.heroInfo, pressed && styles.pressed]}
        >
          <Icon name="location-outline" size={15} color={colors.onBrandMuted} />
          <AppText variant="caption" color={colors.onBrandMuted} style={styles.flex}>
            {branch.addressLine}, {branch.city}
          </AppText>
          {branch.phone ? <Icon name="call-outline" size={15} color={colors.brandSoft} /> : null}
        </Pressable>
      </View>

      {!branch.isOpen ? (
        <Banner
          tone="warning"
          title="La tienda está cerrada"
          message="Puedes explorar el catálogo, pero los pedidos se habilitan cuando vuelva a abrir."
        />
      ) : null}

      {hasOtherCart ? (
        <Banner
          tone="warning"
          message={`Tu carrito actual es de ${cart?.branchName}. Al agregar productos de esta tienda se reemplazará.`}
        />
      ) : null}

      <View style={styles.statGrid}>
        {hasDelivery ? (
          <>
            <StatCard
              icon="bicycle-outline"
              label="Envío"
              value={money(branch.deliveryFee.amountCents, branch.business.currency)}
            />
            <StatCard
              icon="cart-outline"
              label="Mín. domicilio"
              value={money(branch.minOrder.amountCents, branch.business.currency)}
            />
          </>
        ) : null}
        <StatCard icon="time-outline" label="Preparación" value={`${branch.prepTimeMinutes} min`} />
        {hasDelivery ? (
          <StatCard icon="navigate-outline" label="Entrega" value={`${branch.etaMinutes} min`} />
        ) : (
          <StatCard icon="walk-outline" label="Recogida" value="Sin costo" />
        )}
      </View>

      <Card variant="outline" style={styles.scheduleCard}>
        <View style={styles.scheduleHeader}>
          <View style={styles.scheduleIcon}>
            <Icon name="time-outline" size={18} color={colors.brand} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">
              {!hasHours
                ? 'Horario no disponible'
                : todayHours && todayHours.ranges.length > 0
                  ? `Hoy · ${todayHours.ranges.join(' · ')}`
                  : 'Hoy · Cerrado'}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              {!hasHours
                ? 'La tienda aún no publica su horario de atención'
                : branch.isOpen
                  ? 'Abierto en este momento'
                  : 'Fuera del horario de atención'}
            </AppText>
          </View>
          {hasHours ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowSchedule((current) => !current)}
              style={({ pressed }) => [styles.scheduleToggle, pressed && styles.pressed]}
            >
              <AppText variant="caption" color={colors.brand}>
                {showSchedule ? 'Ocultar' : 'Ver semana'}
              </AppText>
              <Icon
                name={showSchedule ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.brand}
              />
            </Pressable>
          ) : null}
        </View>
        {showSchedule ? (
          <View style={styles.scheduleList}>
            {otherHours.length === 0 ? (
              <AppText variant="caption" color={colors.muted}>
                La tienda aún no ha configurado más horarios.
              </AppText>
            ) : (
              otherHours.map((entry) => (
                <View key={entry.day} style={styles.hourRow}>
                  <AppText
                    variant="caption"
                    color={entry.day === today ? colors.brand : colors.textSoft}
                    style={styles.flex}
                  >
                    {days[entry.day]}
                  </AppText>
                  <AppText variant="caption" color={entry.ranges.length ? colors.muted : colors.subtle}>
                    {entry.ranges.length ? entry.ranges.join(' · ') : 'Cerrado'}
                  </AppText>
                </View>
              ))
            )}
          </View>
        ) : null}
      </Card>

      {isTablet ? (
        <View style={styles.mapRow}>
          <View style={styles.flex}>
            <BranchMap branches={mapBranches} height={190} />
          </View>
          <Card variant="plain" style={styles.directionsCard}>
            <Icon name="navigate-circle-outline" size={28} color={colors.brand} />
            <AppText variant="bodyStrong">¿Cómo llegar?</AppText>
            <AppText variant="caption" color={colors.muted}>
              Abre la ubicación exacta en tu app de mapas.
            </AppText>
            <Button
              label="Abrir mapa"
              variant="secondary"
              size="sm"
              icon="open-outline"
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${branch.location.lat},${branch.location.lng}`,
                )
              }
            />
          </Card>
        </View>
      ) : (
        <View style={styles.mobileMap}>
          <BranchMap branches={mapBranches} height={170} />
          <Button
            label="Cómo llegar"
            variant="secondary"
            size="sm"
            icon="navigate-outline"
            onPress={() =>
              void Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${branch.location.lat},${branch.location.lng}`,
              )
            }
          />
        </View>
      )}

      <View style={styles.catalogHeader}>
        <View style={styles.flex}>
          <AppText variant="h2">Catálogo</AppText>
          <AppText variant="caption" color={colors.muted}>
            {branch.products.length}{' '}
            {branch.products.length === 1 ? 'producto en el catálogo' : 'productos en el catálogo'}
          </AppText>
        </View>
        {branch.isOpen ? (
          <Badge label="Pedidos activos" tone="success" dot />
        ) : (
          <Badge label="Solo lectura" tone="neutral" />
        )}
      </View>

      {branch.products.length > 4 ? (
        <TextField
          value={productQuery}
          onChangeText={setProductQuery}
          placeholder="Buscar en el catálogo"
          icon="search"
          autoCorrect={false}
        />
      ) : null}

      {branch.products.length === 0 ? (
        <EmptyState
          compact
          icon="pricetags-outline"
          title="Catálogo en preparación"
          description="Esta tienda todavía no ha publicado productos. Vuelve pronto."
        />
      ) : products.length === 0 ? (
        <EmptyState
          compact
          icon="search-outline"
          title="Sin resultados"
          description={`No encontramos productos para “${productQuery}”.`}
          actionLabel="Limpiar búsqueda"
          onAction={() => setProductQuery('')}
        />
      ) : (
        <View style={styles.list}>
          {isTablet ? (
            <View style={styles.productGrid}>
              {products.map((product) => (
                <View key={product.id} style={styles.productGridItem}>
                  <ProductRow
                    product={product}
                    quantity={cart?.items.find((item) => item.productId === product.id)?.qty ?? 0}
                    currency={branch!.business.currency}
                    disabled={!branch!.isOpen || !product.isAvailable || product.stock === 0}
                    onChange={(quantity) => changeQty(product.id, quantity)}
                  />
                </View>
              ))}
            </View>
          ) : (
            products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                quantity={cart?.items.find((item) => item.productId === product.id)?.qty ?? 0}
                currency={branch.business.currency}
                disabled={!branch.isOpen || !product.isAvailable || product.stock === 0}
                onChange={(quantity) => changeQty(product.id, quantity)}
              />
            ))
          )}
        </View>
      )}

      <AppText variant="caption" color={colors.subtle} align="center" style={styles.footnote}>
        Los precios y totales se confirman al crear el pedido.
      </AppText>
    </Screen>
  );
}

function StatCard({ icon, label, value }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Icon name={icon} size={17} color={colors.brandDark} />
      </View>
      <View style={styles.flex}>
        <AppText variant="caption" color={colors.muted}>
          {label}
        </AppText>
        <AppText variant="label" numberOfLines={1}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

function ProductRow({
  product,
  quantity,
  currency,
  disabled,
  onChange,
}: {
  product: PublicBranch['products'][number];
  quantity: number;
  currency: CurrencyCode;
  disabled: boolean;
  onChange: (quantity: number) => void;
}) {
  const soldOut = !product.isAvailable || product.stock === 0;

  return (
    <Card variant="outline" style={styles.productRow} padding={14}>
      <View style={styles.productIcon}>
        <Icon name="fast-food-outline" size={20} color={colors.brand} />
      </View>
      <View style={styles.productText}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {product.name}
        </AppText>
        {product.description ? (
          <AppText variant="caption" color={colors.muted} numberOfLines={2}>
            {product.description}
          </AppText>
        ) : null}
        {product.stock !== null && product.stock > 0 && product.stock <= 5 && product.isAvailable ? (
          <AppText variant="caption" color={colors.warning}>
            Quedan {product.stock}
          </AppText>
        ) : null}
        {soldOut ? (
          <AppText variant="caption" color={colors.danger}>
            Agotado por ahora
          </AppText>
        ) : null}
      </View>
      <View style={styles.productActions}>
        <AppText variant="bodyStrong">{money(product.priceCents, currency)}</AppText>
        {disabled ? (
          <Badge label={soldOut ? 'Agotado' : 'Cerrada'} tone="neutral" />
        ) : quantity > 0 ? (
          <QuantityStepper
            value={quantity}
            onChange={onChange}
            min={0}
            max={product.stock ?? 99}
          />
        ) : (
          <Button
            label="Agregar"
            size="sm"
            icon="add"
            onPress={() => onChange(1)}
            style={styles.addButton}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: { paddingTop: spacing.md, gap: spacing.md },
  content: { paddingTop: 0, gap: spacing.md },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1, gap: 1 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mobileMap: { gap: spacing.sm, alignItems: 'flex-start' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCard: { gap: spacing.sm },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scheduleIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleToggle: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 },
  scheduleList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 6,
  },
  hourRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  mapRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  directionsCard: { width: 230, gap: 8, justifyContent: 'center' },
  catalogHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.sm },
  list: { gap: spacing.sm },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  productGridItem: { flexGrow: 1, flexBasis: '47%' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  productIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productText: { flex: 1, gap: 2 },
  productActions: { alignItems: 'flex-end', gap: 6 },
  addButton: { minHeight: 36, paddingVertical: 6 },
  footnote: { paddingVertical: spacing.md },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footerText: { flex: 1, gap: 0 },
});
