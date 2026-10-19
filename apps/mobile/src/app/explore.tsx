import { formatMoney } from '@buyersclub/core';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BranchMap } from '../components/branch-map';
import { ApiError } from '../lib/api';
import { findNearby, type CurrencyCode, type NearbyBranch } from '../lib/discovery';
import { getCategories, type Category } from '../lib/vendor';
import { colors, radius, spacing } from '../theme';

const DEFAULT_LOCATION = { lat: 4.6486, lng: -74.0628 };

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'No pudimos cargar las tiendas. Revisa tu conexión.';
}

function distanceLabel(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

export default function ExploreScreen() {
  const router = useRouter();

  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locationLabel, setLocationLabel] = useState('Bogotá (ubicación por defecto)');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<NearbyBranch[]>([]);
  const [openNow, setOpenNow] = useState(false);
  const [fulfillment, setFulfillment] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) {
          return;
        }
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLabel('Tu ubicación actual');
      } catch {
        // Sin permiso se explora la zona por defecto.
      }
    })();
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
      limit: 50,
    })
      .then((value) => {
        if (active) {
          setItems(value);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(messageOf(caught));
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
  }, [location, openNow, fulfillment, categoryId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Tiendas cerca</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.header}>
          <Text style={styles.location}>📍 {locationLabel}</Text>
          <Text style={styles.title}>¿Qué hay cerca de ti?</Text>
          <Text style={styles.subtitle}>
            Comercios locales con su catálogo y estado abierto o cerrado en tiempo real.
          </Text>
        </View>

        <BranchMap
          branches={items.map((branch) => ({
            id: branch.id,
            name: branch.name,
            lat: branch.location.lat,
            lng: branch.location.lng,
            isOpen: branch.isOpen,
          }))}
          onSelect={(id) => router.push({ pathname: '/store', params: { id } })}
          height={260}
        />
        <Text style={styles.mapHint}>Toca un pin para abrir la tienda.</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label="Abiertas ahora"
            selected={openNow}
            onPress={() => setOpenNow((current) => !current)}
          />
          <FilterChip
            label="Domicilio"
            selected={fulfillment === 'delivery'}
            onPress={() =>
              setFulfillment((current) => (current === 'delivery' ? 'all' : 'delivery'))
            }
          />
          <FilterChip
            label="Recogida"
            selected={fulfillment === 'pickup'}
            onPress={() =>
              setFulfillment((current) => (current === 'pickup' ? 'all' : 'pickup'))
            }
          />
          <FilterChip
            label="Todas las categorías"
            selected={categoryId === null}
            onPress={() => setCategoryId(null)}
          />
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={`${category.icon ?? '•'} ${category.name}`}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.muted}>Buscando tiendas…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No encontramos tiendas con esos filtros</Text>
            <Text style={styles.muted}>
              Prueba quitar “Abiertas ahora” o ampliar la zona. Los vendedores aparecen aquí en
              cuanto crean su sucursal.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.results}>{items.length} tiendas en un radio de 7 km</Text>
            {items.map((branch) => (
              <Pressable
                key={branch.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/store', params: { id: branch.id } })}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.rowBetween}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{branch.name}</Text>
                    <Text style={styles.muted}>
                      {branch.business.name}
                      {branch.category ? ` · ${branch.category.name}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.badge, branch.isOpen ? styles.badgeOpen : styles.badgeClosed]}>
                    <Text
                      style={[
                        styles.badgeText,
                        branch.isOpen ? styles.badgeTextOpen : styles.badgeTextClosed,
                      ]}
                    >
                      {branch.isOpen ? 'Abierta' : 'Cerrada'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.muted}>
                  {branch.addressLine} · {distanceLabel(branch.distanceMeters)}
                </Text>

                <View style={styles.tags}>
                  {branch.fulfillment.delivery ? <Tag label="Domicilio" /> : null}
                  {branch.fulfillment.pickup ? <Tag label="Recogida" /> : null}
                  {branch.productPreview.length > 0 ? (
                    <Tag label={`${branch.productPreview.length} productos`} />
                  ) : null}
                </View>

                {branch.productPreview.length > 0 ? (
                  <Text style={styles.preview}>
                    {branch.productPreview
                      .map(
                        (product) =>
                          `${product.name} ${money(product.priceCents, branch.business.currency)}`,
                      )
                      .join(' · ')}
                  </Text>
                ) : null}

                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>
                    Envío {money(branch.deliveryFee.amountCents, branch.business.currency)} ·
                    Mín. domicilio {money(branch.minOrder.amountCents, branch.business.currency)}
                  </Text>
                  <Text style={styles.link}>Ver tienda →</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  spacer: { width: 22 },
  header: { gap: spacing.xs, marginTop: spacing.sm },
  location: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted },
  mapPlaceholder: {
    backgroundColor: '#E6F4F1',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#BFE3DC',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  mapTitle: { color: colors.brandDark, fontWeight: '800', fontSize: 14 },
  mapText: { color: colors.brandDark, fontSize: 12, lineHeight: 18 },
  mapHint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  filterRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF' },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  results: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.9 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitleWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeOpen: { backgroundColor: '#DCFCE7' },
  badgeClosed: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextOpen: { color: '#166534' },
  badgeTextClosed: { color: '#991B1B' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  tagText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  preview: { color: colors.text, fontSize: 12, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 11, flexShrink: 1 },
  link: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
