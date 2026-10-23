import { formatMoney } from '@buyersclub/core';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { BranchMap } from '../../components/branch-map';
import { AppText } from '../../components/ui/app-text';
import { Badge } from '../../components/ui/badge';
import { Banner } from '../../components/ui/banner';
import { Button, IconButton } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Chip, ChipRow } from '../../components/ui/chip';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { Screen } from '../../components/ui/screen';
import { SkeletonCard } from '../../components/ui/skeleton';
import { TextField } from '../../components/ui/text-field';
import { ApiError } from '../../lib/api';
import { findNearby, type CurrencyCode, type NearbyBranch } from '../../lib/discovery';
import { distanceLabel } from '../../lib/format';
import { useResponsive } from '../../lib/responsive';
import { getCategories, type Category } from '../../lib/vendor';
import { colors, radius, spacing, webCursor } from '../../theme';

const DEFAULT_LOCATION = { lat: 4.6486, lng: -74.0628 };

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { isTablet } = useResponsive();

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locationLabel, setLocationLabel] = useState('Bogotá');
  const [locating, setLocating] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<NearbyBranch[]>([]);
  const [openNow, setOpenNow] = useState(false);
  const [fulfillment, setFulfillment] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (permission.status !== 'granted') {
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) {
          return;
        }
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationLabel('Tu ubicación');
      })
      .catch(() => undefined);

    getCategories()
      .then((value) => {
        if (active) {
          setCategories(value);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    findNearby({
      lat: location.lat,
      lng: location.lng,
      radius: 7000,
      openNow,
      fulfillment,
      categoryId,
      q: debouncedQuery || undefined,
      limit: 50,
    })
      .then((value) => {
        if (active) {
          setItems(value);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'No pudimos cargar las tiendas. Revisa tu conexión.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [location, openNow, fulfillment, categoryId, debouncedQuery, refreshKey]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (openNow) count += 1;
    if (fulfillment !== 'all') count += 1;
    if (categoryId) count += 1;
    if (debouncedQuery) count += 1;
    return count;
  }, [openNow, fulfillment, categoryId, debouncedQuery]);

  async function locateMe() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationNotice(
          'Activa el permiso de ubicación en los ajustes de tu dispositivo para ver tiendas cercanas.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationLabel('Tu ubicación');
      setLocationNotice(null);
    } catch {
      setLocationNotice('No pudimos obtener tu ubicación. Inténtalo de nuevo.');
    } finally {
      setLocating(false);
    }
  }

  function clearFilters() {
    setOpenNow(false);
    setFulfillment('all');
    setCategoryId(null);
    setQuery('');
  }

  const results = (
    <>
      {error ? (
        <Banner
          tone="warning"
          title="No pudimos actualizar la búsqueda"
          message={error}
          actionLabel="Reintentar"
          onAction={() => {
            setRefreshing(true);
            setRefreshKey((current) => current + 1);
          }}
        />
      ) : null}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((index) => (
            <SkeletonCard key={`store-skeleton-${index}`} lines={3} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon={error ? 'cloud-offline-outline' : 'storefront-outline'}
          title={error ? 'No pudimos cargar las tiendas' : 'No encontramos tiendas con esos filtros'}
          description={
            error
              ? 'Revisa tu conexión y vuelve a intentarlo.'
              : 'Prueba con otra búsqueda, quita “Abiertas ahora” o amplía la zona. Los vendedores aparecen aquí al publicar su sucursal.'
          }
          actionLabel={error ? 'Reintentar' : activeFilters > 0 ? 'Limpiar filtros' : 'Actualizar'}
          onAction={
            error
              ? () => {
                  setRefreshing(true);
                  setRefreshKey((current) => current + 1);
                }
              : activeFilters > 0
                ? clearFilters
                : () => {
                    setRefreshing(true);
                    setRefreshKey((current) => current + 1);
                  }
          }
        />
      ) : (
        <>
          <View style={styles.resultsRow}>
            <AppText variant="caption" color={colors.muted}>
              {items.length} {items.length === 1 ? 'tienda' : 'tiendas'} en 7 km
            </AppText>
            {activeFilters > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={clearFilters}
                style={({ pressed }) => [styles.clearLink, pressed && styles.pressed, webCursor]}
              >
                <Icon name="close-circle" size={14} color={colors.brand} />
                <AppText variant="caption" color={colors.brand}>
                  Limpiar filtros
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.list}>
            {items.map((branch) => (
              <StoreResultCard
                key={branch.id}
                branch={branch}
                onPress={() => router.push({ pathname: '/store', params: { id: branch.id } })}
              />
            ))}
          </View>
        </>
      )}
    </>
  );

  const mapBranches = useMemo(
    () =>
      items.map((branch) => ({
        id: branch.id,
        name: branch.name,
        lat: branch.location.lat,
        lng: branch.location.lng,
        isOpen: branch.isOpen,
      })),
    [items],
  );

  const map = showMap ? (
    <View style={styles.mapWrap}>
      <BranchMap
        branches={mapBranches}
        onSelect={(id) => router.push({ pathname: '/store', params: { id } })}
        height={isTablet ? 360 : 210}
      />
      <TextHint>Toca un pin para abrir la tienda</TextHint>
    </View>
  ) : null;

  return (
    <Screen
      maxWidth={1120}
      contentContainerStyle={styles.content}
      bottomInset={spacing.lg}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setRefreshKey((current) => current + 1);
          }}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="micro" color={colors.brand} style={styles.eyebrow}>
            DESCUBRIR
          </AppText>
          <AppText variant="h1">Tiendas cerca</AppText>
          <AppText variant="body" color={colors.muted}>
            Catálogo, distancia y apertura en tiempo real.
          </AppText>
        </View>
        <IconButton
          icon={showMap ? 'list-outline' : 'map-outline'}
          label={showMap ? 'Ocultar mapa' : 'Mostrar mapa'}
          onPress={() => setShowMap((current) => !current)}
        />
      </View>

      <View style={styles.searchRow}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Busca una tienda, producto o categoría"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          icon="search"
          containerStyle={styles.searchInput}
        />
      </View>

      <View style={styles.locationCard}>
        <View style={styles.locationIcon}>
          <Icon name="location" size={17} color={colors.brandDark} />
        </View>
        <View style={styles.flex}>
          <AppText variant="label">{locationLabel}</AppText>
          <AppText variant="caption" color={colors.muted}>
            {locationLabel === 'Tu ubicación'
              ? 'Mostrando comercios a tu alrededor'
              : 'Ubicación por defecto · activa tu GPS para mayor precisión'}
          </AppText>
        </View>
        <Button
          label={locating ? 'Ubicando…' : locationLabel === 'Tu ubicación' ? 'Actualizar' : 'Usar mi ubicación'}
          onPress={locateMe}
          variant="soft"
          size="sm"
          loading={locating}
          disabled={locating}
        />
      </View>

      {locationNotice ? (
        <Banner
          tone="warning"
          title="Ubicación no disponible"
          message={locationNotice}
          actionLabel="Reintentar"
          onAction={() => void locateMe()}
        />
      ) : null}

      <ChipRow>
        <Chip
          label="Abiertas ahora"
          icon="time-outline"
          selected={openNow}
          onPress={() => setOpenNow((current) => !current)}
        />
        <Chip
          label="Domicilio"
          icon="bicycle-outline"
          selected={fulfillment === 'delivery'}
          onPress={() => setFulfillment((current) => (current === 'delivery' ? 'all' : 'delivery'))}
        />
        <Chip
          label="Recogida"
          icon="walk-outline"
          selected={fulfillment === 'pickup'}
          onPress={() => setFulfillment((current) => (current === 'pickup' ? 'all' : 'pickup'))}
        />
        <Chip
          label="Todas"
          selected={categoryId === null}
          onPress={() => setCategoryId(null)}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            selected={categoryId === category.id}
            onPress={() => setCategoryId(category.id)}
          />
        ))}
      </ChipRow>

      {isTablet ? (
        <View style={styles.columns}>
          <View style={styles.mapColumn}>{map}</View>
          <View style={styles.resultsColumn}>{results}</View>
        </View>
      ) : (
        <>
          {map}
          {results}
        </>
      )}
    </Screen>
  );
}

function TextHint({ children }: { children: string }) {
  return (
    <View style={styles.mapHint}>
      <Icon name="hand-left-outline" size={13} color={colors.muted} />
      <AppText variant="caption" color={colors.muted}>
        {children}
      </AppText>
    </View>
  );
}

function StoreResultCard({ branch, onPress }: { branch: NearbyBranch; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.storeCard} accessibilityLabel={`Abrir ${branch.name}`}>
      <View style={styles.storeHeader}>
        <View style={styles.storeAvatar}>
          <Icon name="storefront-outline" size={22} color={colors.brandDark} />
        </View>
        <View style={styles.storeTitleWrap}>
          <AppText variant="h3" numberOfLines={1}>
            {branch.name}
          </AppText>
          <AppText variant="caption" color={colors.muted} numberOfLines={1}>
            {branch.business.name}
            {branch.category ? ` · ${branch.category.name}` : ''}
          </AppText>
        </View>
        <Badge
          label={branch.isOpen ? 'Abierta' : 'Cerrada'}
          tone={branch.isOpen ? 'success' : 'danger'}
          dot
        />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon name="navigate-outline" size={14} color={colors.muted} />
          <AppText variant="caption" color={colors.muted}>
            {distanceLabel(branch.distanceMeters)}
          </AppText>
        </View>
        <View style={styles.metaItem}>
          <Icon name="location-outline" size={14} color={colors.muted} />
          <AppText variant="caption" color={colors.muted} numberOfLines={1} style={styles.metaText}>
            {branch.addressLine}
          </AppText>
        </View>
      </View>

      <View style={styles.tags}>
        {branch.fulfillment.delivery ? (
          <Badge label="Domicilio" tone="neutral" icon="bicycle-outline" />
        ) : null}
        {branch.fulfillment.pickup ? (
          <Badge label="Recogida" tone="neutral" icon="walk-outline" />
        ) : null}
        {branch.productPreview.length > 0 ? (
          <Badge label="Destacados" tone="brand" icon="pricetags-outline" />
        ) : null}
      </View>

      {branch.productPreview.length > 0 ? (
        <View style={styles.preview}>
          {branch.productPreview.slice(0, 3).map((product) => (
            <View key={product.name} style={styles.previewItem}>
              <AppText variant="caption" color={colors.textSoft} numberOfLines={1} style={styles.flex}>
                {product.name}
              </AppText>
              <AppText variant="caption" color={colors.text}>
                {money(product.priceCents, branch.business.currency)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.storeFooter}>
        <AppText variant="caption" color={colors.muted} style={styles.flex} numberOfLines={1}>
          {branch.fulfillment.delivery
            ? `Envío ${money(branch.deliveryFee.amountCents, branch.business.currency)} · Mín. ${money(
                branch.minOrder.amountCents,
                branch.business.currency,
              )}`
            : 'Recogida en tienda · Sin costo de envío'}
        </AppText>
        <View style={styles.viewStore}>
          <AppText variant="label" color={colors.brand}>
            Ver tienda
          </AppText>
          <Icon name="arrow-forward" size={14} color={colors.brand} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.sm, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  eyebrow: { textTransform: 'uppercase', marginBottom: 2 },
  searchRow: { flexDirection: 'row', gap: spacing.sm, flex: 1 },
  searchInput: { flex: 1 },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrap: { gap: 6 },
  mapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  mapColumn: { flex: 1, position: 'relative' },
  resultsColumn: { flex: 1.25, gap: spacing.md },
  resultsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  clearLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  pressed: { opacity: 0.7 },
  list: { gap: spacing.sm },
  storeCard: { gap: 9 },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  storeAvatar: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTitleWrap: { flex: 1, gap: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  metaText: { flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 5,
  },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  storeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
  },
  viewStore: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
