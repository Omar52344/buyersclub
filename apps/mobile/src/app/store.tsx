import { formatMoney } from '@buyersclub/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useCart } from '../lib/cart';
import { getPublicBranch, type CurrencyCode, type PublicBranch } from '../lib/discovery';
import { colors, radius, spacing } from '../theme';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

export default function StoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;

  const [branch, setBranch] = useState<PublicBranch | null>(null);
  const { cart, itemCount, subtotalCents, addItem } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!id) {
      setError('No encontramos la tienda.');
      setLoading(false);
      return;
    }
    getPublicBranch(id)
      .then((value) => {
        if (active) {
          setBranch(value);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof ApiError ? caught.message : 'No pudimos cargar la tienda.',
          );
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Cargando tienda…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!branch) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>← Volver</Text>
          </Pressable>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error ?? 'No pudimos cargar la tienda.'}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const schedule = [0, 1, 2, 3, 4, 5, 6]
    .map((day) => ({
      day,
      ranges: branch.hours
        .filter((hour) => hour.weekday === day && !hour.isClosed)
        .map((hour) => `${hour.opensAt.slice(0, 5)}–${hour.closesAt.slice(0, 5)}`),
    }))
    .filter((entry) => entry.ranges.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Tienda</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.business}>{branch.business.name}</Text>
          <Text style={styles.title}>{branch.name}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, branch.isOpen ? styles.badgeOpen : styles.badgeClosed]}>
              <Text
                style={[
                  styles.badgeText,
                  branch.isOpen ? styles.badgeTextOpen : styles.badgeTextClosed,
                ]}
              >
                {branch.isOpen ? 'Abierta ahora' : 'Cerrada'}
              </Text>
            </View>
            {branch.category ? (
              <View style={styles.badgeNeutral}>
                <Text style={styles.badgeNeutralText}>{branch.category.name}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.muted}>
            {branch.addressLine}, {branch.city}
          </Text>
          {branch.phone ? <Text style={styles.muted}>Tel. {branch.phone}</Text> : null}
        </View>

        {!branch.isOpen ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              La tienda está cerrada en este momento. Puedes ver el catálogo, pero los pedidos se
              habilitan cuando abra.
            </Text>
          </View>
        ) : null}

        <BranchMap
          branches={[
            {
              id: branch.id,
              name: branch.name,
              lat: branch.location.lat,
              lng: branch.location.lng,
              isOpen: branch.isOpen,
            },
          ]}
          height={180}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrega</Text>
          <View style={styles.tags}>
            {branch.fulfillment.delivery ? <Tag label="Domicilio" /> : null}
            {branch.fulfillment.pickup ? <Tag label="Recogida en tienda" /> : null}
          </View>
          <Text style={styles.muted}>
            Envío {money(branch.deliveryFee.amountCents, branch.business.currency)} · Pedido
            mínimo {money(branch.minOrder.amountCents, branch.business.currency)}
          </Text>
          <Text style={styles.muted}>
            Preparación estimada {branch.prepTimeMinutes} min · Entrega {branch.etaMinutes} min
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Horario</Text>
          {schedule.length === 0 ? (
            <Text style={styles.muted}>La tienda aún no ha configurado horarios.</Text>
          ) : (
            schedule.map((entry) => (
              <View key={entry.day} style={styles.hourRow}>
                <Text style={styles.hourDay}>{DAY_NAMES[entry.day]}</Text>
                <Text style={styles.hourValue}>{entry.ranges.join(' · ')}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Catálogo</Text>
          <Text style={styles.muted}>{branch.products.length} productos</Text>
        </View>

        {branch.products.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Esta tienda todavía no ha publicado productos.</Text>
          </View>
        ) : (
          branch.products.map((product) => (
            <View key={product.id} style={styles.productRow}>
              <View style={styles.productText}>
                <Text style={styles.productName}>{product.name}</Text>
                {product.description ? (
                  <Text style={styles.muted} numberOfLines={2}>
                    {product.description}
                  </Text>
                ) : null}
              </View>
              <View style={styles.productActions}>
                <Text style={styles.productPrice}>
                  {money(product.priceCents, product.currency)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={!branch.isOpen}
                  onPress={() =>
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
                        qty: 1,
                      },
                    )
                  }
                  style={[styles.addButton, !branch.isOpen && styles.addButtonDisabled]}
                >
                  <Text style={styles.addButtonText}>
                    {branch.isOpen ? 'Agregar' : 'Cerrada'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {itemCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/cart')}
            style={styles.cartBar}
          >
            <View>
              <Text style={styles.cartBarText}>
                {itemCount} ítems ·{' '}
                {money(subtotalCents, cart?.currency ?? branch.business.currency)}
              </Text>
              {cart && cart.branchId !== branch.id ? (
                <Text style={styles.cartBarHint}>Carrito de {cart.branchName}</Text>
              ) : null}
            </View>
            <Text style={styles.cartBarAction}>Ver carrito →</Text>
          </Pressable>
        ) : (
          <Text style={styles.footnote}>
            Agrega productos para iniciar un pedido a domicilio o para recoger.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
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
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  spacer: { width: 22 },
  hero: { gap: spacing.xs, marginTop: spacing.sm },
  business: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: 4 },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeOpen: { backgroundColor: '#DCFCE7' },
  badgeClosed: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextOpen: { color: '#166534' },
  badgeTextClosed: { color: '#991B1B' },
  badgeNeutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeNeutralText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  warningBox: { backgroundColor: '#FEF3C7', borderRadius: radius.md, padding: spacing.md },
  warningText: { color: '#92400E', fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  hourDay: { color: colors.text, fontSize: 13, fontWeight: '600' },
  hourValue: { color: colors.muted, fontSize: 13 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  productRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  productText: { flex: 1, gap: 2 },
  productActions: { alignItems: 'flex-end', gap: 6 },
  addButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addButtonDisabled: { backgroundColor: colors.border },
  addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  cartBar: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cartBarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cartBarHint: { color: '#D1FAE5', fontSize: 11, marginTop: 2 },
  cartBarAction: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  productName: { fontSize: 14, fontWeight: '700', color: colors.text },
  productPrice: { fontSize: 14, fontWeight: '800', color: colors.text },
  orderButtonDisabled: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  orderButtonText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  footnote: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
