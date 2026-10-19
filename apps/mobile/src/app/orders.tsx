import { formatMoney } from '@buyersclub/core';
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
import { StatusBadge } from '../components/status-badge';
import { ApiError } from '../lib/api';
import { getOrders, type OrderSummary } from '../lib/orders';
import { colors, radius, spacing } from '../theme';

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setOrders(await getOrders());
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'No pudimos cargar tus pedidos.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Mis pedidos</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()}>
            <Text style={styles.refresh}>Actualizar</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.muted}>Cargando pedidos…</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Todavía no tienes pedidos</Text>
            <Text style={styles.muted}>
              Explora las tiendas cercanas, agrega productos y confirma tu primer pedido.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/explore')}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Explorar tiendas</Text>
            </Pressable>
          </View>
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/order', params: { id: order.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.code}>{order.code}</Text>
                <StatusBadge status={order.status} />
              </View>
              <Text style={styles.business}>{order.businessName}</Text>
              <Text style={styles.muted}>
                {order.branchName} · {order.fulfillment === 'delivery' ? 'Domicilio' : 'Recogida'}
              </Text>
              <Text style={styles.muted}>
                {order.itemCount} ítems
                {order.firstItem ? ` · ${order.firstItem}` : ''}
              </Text>
              <View style={styles.rowBetween}>
                <Text style={styles.date}>{dateLabel(order.createdAt)}</Text>
                <Text style={styles.total}>{money(order.totalCents, order.currency)}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  refresh: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  cardPressed: { opacity: 0.9 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  code: { fontSize: 13, fontWeight: '800', color: colors.brandDark, letterSpacing: 0.5 },
  business: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 },
  date: { color: colors.muted, fontSize: 12 },
  total: { color: colors.text, fontSize: 15, fontWeight: '800' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
