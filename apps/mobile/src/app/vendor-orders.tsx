import { formatMoney } from '@buyersclub/core';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBadge } from '../components/status-badge';
import { API_URL, ApiError } from '../lib/api';
import type { OrderStatus } from '../lib/orders';
import { getBusinessOrders, updateOrderStatus, type BusinessOrder } from '../lib/orders';
import { rejectPayment, validatePayment } from '../lib/payments';
import { getMyBusinesses, type Business } from '../lib/vendor';
import { colors, radius, spacing } from '../theme';

const ACTIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['accepted', 'rejected'],
  awaiting_payment: [],
  accepted: ['preparing', 'rejected'],
  preparing: ['ready', 'out_for_delivery', 'rejected'],
  ready: ['completed'],
  out_for_delivery: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
};

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  accepted: 'Aceptar',
  preparing: 'Preparar',
  ready: 'Listo',
  out_for_delivery: 'En camino',
  completed: 'Completar',
  rejected: 'Rechazar',
};

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

function actionsFor(order: BusinessOrder): OrderStatus[] {
  const base = ACTIONS[order.status] ?? [];
  return base.filter((action) => {
    if (action === 'ready' && order.fulfillment === 'delivery') {
      return false;
    }
    if (action === 'out_for_delivery' && order.fulfillment === 'pickup') {
      return false;
    }
    return true;
  });
}

function addressText(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }
  const value = snapshot as { line1?: string; city?: string; notes?: string };
  const parts = [value.line1, value.city, value.notes].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}


function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'evidence_submitted':
      return 'Comprobante recibido';
    case 'validated':
      return 'Pago validado';
    case 'rejected':
      return 'Pago rechazado';
    case 'refunded':
      return 'Reembolsado';
    default:
      return 'Pago pendiente';
  }
}

export default function VendorOrdersScreen() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const businesses = await getMyBusinesses();
      const first = businesses[0] ?? null;
      setBusiness(first);
      if (first) {
        setOrders(await getBusinessOrders(first.id));
      } else {
        setOrders([]);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAction(order: BusinessOrder, status: OrderStatus) {
    if (!business) {
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      await updateOrderStatus(
        order.id,
        status,
        status === 'rejected' ? 'Rechazado por la tienda' : undefined,
      );
      setOrders(await getBusinessOrders(business.id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos actualizar el pedido.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleValidate(order: BusinessOrder) {
    if (!order.payment) {
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      await validatePayment(order.payment.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos validar el pago.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(order: BusinessOrder) {
    if (!order.payment) {
      return;
    }
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setError('Escribe el motivo del rechazo.');
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      await rejectPayment(order.payment.id, reason);
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos rechazar el pago.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Pedidos</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()}>
            <Text style={styles.refresh}>Actualizar</Text>
          </Pressable>
        </View>

        {business ? (
          <Text style={styles.businessName}>{business.name}</Text>
        ) : null}

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
        ) : !business ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Primero crea tu empresa</Text>
            <Text style={styles.muted}>
              Cuando tengas una sucursal y productos, los pedidos aparecerán aquí.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/vendor')}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Ir a Mi negocio</Text>
            </Pressable>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin pedidos todavía</Text>
            <Text style={styles.muted}>
              Comparte tu tienda y mantén la sucursal abierta para recibir pedidos.
            </Text>
          </View>
        ) : (
          orders.map((order) => {
            const actions = actionsFor(order);
            const address = addressText(order.deliveryAddressSnapshot);
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.code}>{order.code}</Text>
                  <StatusBadge status={order.status} />
                </View>
                <Text style={styles.buyer}>
                  {order.buyerName ?? 'Cliente'}
                  {order.buyerPhone ? ` · ${order.buyerPhone}` : ''}
                </Text>
                <Text style={styles.muted}>
                  {order.branchName} ·{' '}
                  {order.fulfillment === 'delivery' ? 'Domicilio' : 'Recogida'} ·{' '}
                  {money(order.totalCents, order.currency)}
                </Text>
                <Text style={styles.items}>
                  {order.items.map((item) => `${item.qty}× ${item.name}`).join(' · ')}
                </Text>
                {address ? <Text style={styles.muted}>📍 {address}</Text> : null}

                {actions.length > 0 ? (
                  <View style={styles.actions}>
                    {actions.map((action) => (
                      <Pressable
                        key={action}
                        accessibilityRole="button"
                        disabled={busyId === order.id}
                        onPress={() => handleAction(order, action)}
                        style={[
                          styles.actionButton,
                          action === 'rejected' && styles.actionDanger,
                          busyId === order.id && styles.disabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            action === 'rejected' && styles.actionDangerText,
                          ]}
                        >
                          {ACTION_LABELS[action] ?? action}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {order.payment ? (
                  <View style={styles.paymentBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.paymentTitle}>Pago</Text>
                      <Text style={styles.paymentStatus}>
                        {paymentStatusLabel(order.payment.status)}
                      </Text>
                    </View>
                    {order.payment.evidenceUrl ? (
                      <Image
                        source={{ uri: `${API_URL}${order.payment.evidenceUrl}` }}
                        style={styles.evidence}
                      />
                    ) : null}
                    {order.payment.note ? (
                      <Text style={styles.muted}>Nota: {order.payment.note}</Text>
                    ) : null}
                    {order.payment.rejectionReason ? (
                      <Text style={styles.rejectReason}>
                        Motivo: {order.payment.rejectionReason}
                      </Text>
                    ) : null}

                    {order.payment.status === 'evidence_submitted' ? (
                      rejectingId === order.id ? (
                        <View style={styles.rejectBox}>
                          <TextInput
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder="Motivo del rechazo"
                            placeholderTextColor="#9AA8A4"
                            style={styles.rejectInput}
                          />
                          <View style={styles.actions}>
                            <Pressable
                              accessibilityRole="button"
                              disabled={busyId === order.id}
                              onPress={() => handleReject(order)}
                              style={[styles.actionDanger, styles.actionSolid]}
                            >
                              <Text style={styles.actionDangerText}>Confirmar rechazo</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                              style={styles.actionNeutral}
                            >
                              <Text style={styles.actionNeutralText}>Cancelar</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.actions}>
                          <Pressable
                            accessibilityRole="button"
                            disabled={busyId === order.id}
                            onPress={() => handleValidate(order)}
                            style={[styles.actionButton, busyId === order.id && styles.disabled]}
                          >
                            <Text style={styles.actionText}>Validar pago</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            disabled={busyId === order.id}
                            onPress={() => setRejectingId(order.id)}
                            style={styles.actionDanger}
                          >
                            <Text style={styles.actionDangerText}>Rechazar</Text>
                          </Pressable>
                        </View>
                      )
                    ) : null}
                  </View>
                ) : order.paymentMethod === 'transfer' ? (
                  <Text style={styles.pendingPayment}>
                    Esperando comprobante del comprador.
                  </Text>
                ) : null}

                {order.conversationId ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/chat', params: { id: order.conversationId } })
                    }
                    style={styles.chatLink}
                  >
                    <Text style={styles.chatLinkText}>Abrir chat con el comprador →</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
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
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  refresh: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  businessName: { fontSize: 13, fontWeight: '700', color: colors.brand },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  code: { fontSize: 13, fontWeight: '800', color: colors.brandDark, letterSpacing: 0.5 },
  buyer: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 4 },
  items: { fontSize: 12, color: colors.text, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  actionDanger: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  actionDangerText: { color: colors.danger },
  pendingPayment: { color: '#92400E', fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
  paymentBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  paymentTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  paymentStatus: { fontSize: 12, fontWeight: '700', color: colors.brandDark },
  evidence: {
    width: '100%',
    height: 160,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    resizeMode: 'contain',
  },
  rejectReason: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  rejectBox: { gap: spacing.sm },
  rejectInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  actionSolid: { backgroundColor: colors.danger, borderColor: colors.danger },
  actionNeutral: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
    backgroundColor: colors.surface,
  },
  actionNeutralText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chatLink: { marginTop: spacing.sm, paddingVertical: 4 },
  chatLinkText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
