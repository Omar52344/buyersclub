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
import { StatusBadge } from '../components/status-badge';
import { ApiError } from '../lib/api';
import { ORDER_STATUS_LABELS } from '../lib/order-labels';
import {
  cancelOrder,
  getOrder,
  type OrderDetail,
  type OrderStatus,
} from '../lib/orders';
import { colors, radius, spacing } from '../theme';

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

function dateLabel(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const FINAL: OrderStatus[] = ['completed', 'cancelled', 'rejected'];

export default function OrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) {
      setError('No encontramos el pedido.');
      setLoading(false);
      return;
    }
    getOrder(id)
      .then((value) => {
        if (active) {
          setOrder(value);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar el pedido.');
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

  async function handleCancel() {
    if (!order) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await cancelOrder(order.id, 'Cancelado por el comprador');
      setOrder(updated);
      setConfirming(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cancelar el pedido.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Cargando pedido…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>← Volver</Text>
          </Pressable>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error ?? 'No encontramos el pedido.'}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const address = order.deliveryAddress;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>{order.code}</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.rowBetween}>
            <Text style={styles.business}>{order.business.name}</Text>
            <StatusBadge status={order.status} />
          </View>
          <Text style={styles.muted}>
            {order.branch.name} · {order.branch.addressLine}, {order.branch.city}
          </Text>
          {!FINAL.includes(order.status) && order.etaAt ? (
            <Text style={styles.eta}>Entrega estimada: {dateLabel(order.etaAt)}</Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seguimiento</Text>
          {order.events.map((event, index) => (
            <View key={`${event.status}-${index}`} style={styles.eventRow}>
              <View style={styles.eventMarker}>
                <View
                  style={[
                    styles.eventDot,
                    index === order.events.length - 1 && styles.eventDotActive,
                  ]}
                />
              </View>
              <View style={styles.eventBody}>
                <Text style={styles.eventTitle}>{ORDER_STATUS_LABELS[event.status]}</Text>
                {event.note ? <Text style={styles.muted}>{event.note}</Text> : null}
                <Text style={styles.eventTime}>{dateLabel(event.at)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Productos</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.qty}×</Text>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.notes ? <Text style={styles.muted}>{item.notes}</Text> : null}
              </View>
              <Text style={styles.itemTotal}>
                {money(item.lineTotalCents, order.currency)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Row label="Subtotal" value={money(order.subtotalCents, order.currency)} />
          {order.deliveryFeeCents > 0 ? (
            <Row label="Domicilio" value={money(order.deliveryFeeCents, order.currency)} />
          ) : null}
          <Row label="Total" value={money(order.totalCents, order.currency)} strong />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {order.fulfillment === 'delivery' ? 'Entrega a domicilio' : 'Recogida en tienda'}
          </Text>
          {order.fulfillment === 'delivery' && address ? (
            <>
              <Text style={styles.muted}>{address.line1}</Text>
              {address.line2 ? <Text style={styles.muted}>{address.line2}</Text> : null}
              <Text style={styles.muted}>{address.city}</Text>
              {address.recipientName ? (
                <Text style={styles.muted}>Recibe: {address.recipientName}</Text>
              ) : null}
              {address.notes ? <Text style={styles.muted}>Notas: {address.notes}</Text> : null}
            </>
          ) : (
            <Text style={styles.muted}>
              Recoges en {order.branch.addressLine}, {order.branch.city}. Te avisaremos cuando el
              pedido esté listo.
            </Text>
          )}
          <Text style={styles.muted}>
            Pago: {order.paymentMethod === 'cash' ? 'Efectivo' : order.paymentMethod === 'card_terminal' ? 'Datáfono' : 'Otro'} ·{' '}
            {order.paymentStatus === 'validated' ? 'validado' : 'pendiente'}
          </Text>
        </View>

        {order.conversationId ? (
          <View style={styles.chatCard}>
            <Text style={styles.chatTitle}>Chat con la tienda</Text>
            <Text style={styles.muted}>
              El chat y el comprobante de pago llegan en la Fase 5.
            </Text>
          </View>
        ) : null}

        {order.canCancel ? (
          confirming ? (
            <View style={styles.cancelBox}>
              <Text style={styles.cancelQuestion}>¿Seguro que quieres cancelar el pedido?</Text>
              <View style={styles.cancelActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={handleCancel}
                  style={[styles.cancelConfirm, busy && styles.disabled]}
                >
                  <Text style={styles.cancelConfirmText}>Sí, cancelar</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirming(false)}
                  style={styles.cancelBack}
                >
                  <Text style={styles.cancelBackText}>No</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirming(true)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancelar pedido</Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
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
  topTitle: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  spacer: { width: 22 },
  hero: { gap: 4, marginTop: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  business: { fontSize: 24, fontWeight: '800', color: colors.text, flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  eta: { color: colors.brandDark, fontSize: 13, fontWeight: '700', marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 },
  eventRow: { flexDirection: 'row', gap: spacing.md },
  eventMarker: { alignItems: 'center', width: 14 },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  eventDotActive: { backgroundColor: colors.brand },
  eventBody: { flex: 1, paddingBottom: spacing.md, gap: 1 },
  eventTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  eventTime: { fontSize: 11, color: colors.muted },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  itemQty: { color: colors.muted, fontSize: 13, fontWeight: '700', minWidth: 24 },
  itemText: { flex: 1, gap: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: colors.text },
  itemTotal: { fontSize: 13, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  rowStrong: { fontSize: 16, fontWeight: '800', color: colors.text },
  chatCard: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  chatTitle: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelButtonText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  cancelBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cancelQuestion: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  cancelActions: { flexDirection: 'row', gap: spacing.sm },
  cancelConfirm: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelConfirmText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  cancelBack: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBackText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
