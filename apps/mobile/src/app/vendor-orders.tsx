import { formatMoney } from '@buyersclub/core';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
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
import { connectRealtime } from '../lib/realtime';
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
  accepted: 'Aceptar pedido',
  preparing: 'Empezar preparación',
  ready: 'Listo para recoger',
  out_for_delivery: 'En camino',
  completed: 'Marcar entregado',
  rejected: 'Rechazar',
};

const DONE_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'rejected'];

interface StatusTheme {
  accent: string;
  tint: string;
  border: string;
}

const STATUS_THEME: Record<OrderStatus, StatusTheme> = {
  pending: { accent: '#D97706', tint: '#FFFBEB', border: '#FDE68A' },
  awaiting_payment: { accent: '#D97706', tint: '#FFFBEB', border: '#FDE68A' },
  accepted: { accent: '#2563EB', tint: '#EFF6FF', border: '#BFDBFE' },
  preparing: { accent: '#4F46E5', tint: '#EEF2FF', border: '#C7D2FE' },
  ready: { accent: '#059669', tint: '#ECFDF5', border: '#A7F3D0' },
  out_for_delivery: { accent: '#0D9488', tint: '#F0FDFA', border: '#99F6E4' },
  completed: { accent: '#64748B', tint: '#F8FAFC', border: '#E2E8F0' },
  cancelled: { accent: '#DC2626', tint: '#FEF2F2', border: '#FECACA' },
  rejected: { accent: '#DC2626', tint: '#FEF2F2', border: '#FECACA' },
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

function paymentMethodLabel(method: BusinessOrder['paymentMethod']): string {
  switch (method) {
    case 'cash':
      return 'Efectivo';
    case 'card_terminal':
      return 'Datáfono';
    case 'transfer':
      return 'Transferencia';
    default:
      return 'Otro';
  }
}

function waitingLabel(createdAt: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
  );
  if (minutes < 1) {
    return 'ahora';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ${minutes % 60} min`;
  }
  return `${Math.floor(hours / 24)} d`;
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  });
}

function isDone(order: BusinessOrder): boolean {
  return DONE_STATUSES.includes(order.status);
}

export default function VendorOrdersScreen() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showAllDone, setShowAllDone] = useState(false);

  const load = useCallback(async (showSpinner: boolean, showRefreshIndicator = false) => {
    if (showSpinner) {
      setLoading(true);
    }
    if (showRefreshIndicator) {
      setRefreshing(true);
    }
    try {
      const businesses = await getMyBusinesses();
      const first = businesses[0] ?? null;
      setBusiness(first);
      setOrders(first ? await getBusinessOrders(first.id) : []);
      setLastUpdated(new Date());
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar los pedidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load(false);
    }, 15_000);
    const disconnect = connectRealtime((event) => {
      if (
        event.type === 'order.created' ||
        event.type === 'order.status_changed' ||
        event.type === 'payment.updated'
      ) {
        void load(false);
      }
    });
    return () => {
      clearInterval(timer);
      disconnect();
    };
  }, [load]);

  const groups = useMemo(() => {
    const oldestFirst = [...orders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const newestFirst = [...orders]
      .filter(isDone)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      attention: oldestFirst.filter(
        (order) => order.status === 'pending' || order.status === 'awaiting_payment',
      ),
      preparing: oldestFirst.filter(
        (order) => order.status === 'accepted' || order.status === 'preparing',
      ),
      ready: oldestFirst.filter(
        (order) => order.status === 'ready' || order.status === 'out_for_delivery',
      ),
      done: newestFirst,
    };
  }, [orders]);

  const doneVisible = showAllDone ? groups.done : groups.done.slice(0, 3);
  const activeCount = groups.attention.length + groups.preparing.length + groups.ready.length;

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
      await load(false);
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
      await load(false);
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
      await load(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos rechazar el pago.');
    } finally {
      setBusyId(null);
    }
  }

  function renderCard(order: BusinessOrder) {
    return (
      <OrderCard
        key={order.id}
        order={order}
        busy={busyId === order.id}
        rejecting={rejectingId === order.id}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        onAction={(status) => void handleAction(order, status)}
        onValidate={() => void handleValidate(order)}
        onReject={() => void handleReject(order)}
        onStartReject={() => setRejectingId(order.id)}
        onCancelReject={() => {
          setRejectingId(null);
          setRejectReason('');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(false, true)}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Pedidos</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load(false, true)}
            disabled={refreshing}
          >
            <Text style={styles.refresh}>{refreshing ? '…' : 'Actualizar'}</Text>
          </Pressable>
        </View>

        {business ? (
          <View style={styles.headerBlock}>
            <Text style={styles.businessName}>{business.name}</Text>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                Se actualiza solo
                {lastUpdated
                  ? ` · ${lastUpdated.toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </Text>
            </View>
            {orders.length > 0 ? (
              <Text style={styles.summary}>
                {groups.attention.length} por atender ·{' '}
                {groups.preparing.length + groups.ready.length} en curso ·{' '}
                {groups.done.length} finalizados
              </Text>
            ) : null}
          </View>
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
          <>
            {groups.attention.length > 0 ? (
              <OrderSection
                title="Por atender"
                subtitle="Pedidos nuevos o con pago por validar"
                accent="#D97706"
                count={groups.attention.length}
              >
                {groups.attention.map(renderCard)}
              </OrderSection>
            ) : null}

            {groups.preparing.length > 0 ? (
              <OrderSection
                title="En preparación"
                subtitle="Ya aceptaste; prepara y avisa al comprador"
                accent="#2563EB"
                count={groups.preparing.length}
              >
                {groups.preparing.map(renderCard)}
              </OrderSection>
            ) : null}

            {groups.ready.length > 0 ? (
              <OrderSection
                title="Listos y en camino"
                subtitle="Pendientes de entrega o recogida"
                accent="#059669"
                count={groups.ready.length}
              >
                {groups.ready.map(renderCard)}
              </OrderSection>
            ) : null}

            {activeCount === 0 ? (
              <View style={styles.allClear}>
                <Text style={styles.allClearIcon}>✓</Text>
                <View style={styles.allClearText}>
                  <Text style={styles.allClearTitle}>Todo al día</Text>
                  <Text style={styles.muted}>
                    No tienes pedidos pendientes de gestión.
                  </Text>
                </View>
              </View>
            ) : null}

            {groups.done.length > 0 ? (
              <OrderSection
                title="Finalizados"
                subtitle="Entregados, cancelados o rechazados"
                accent="#64748B"
                count={groups.done.length}
              >
                {doneVisible.map(renderCard)}
                {groups.done.length > 3 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAllDone((value) => !value)}
                    style={styles.showMore}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllDone
                        ? 'Ver menos'
                        : `Ver todos los finalizados (${groups.done.length})`}
                    </Text>
                  </Pressable>
                ) : null}
              </OrderSection>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderSection({
  title,
  subtitle,
  accent,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: accent }]} />
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: `${accent}1A` }]}>
          <Text style={[styles.countText, { color: accent }]}>{count}</Text>
        </View>
      </View>
      <View style={styles.sectionCards}>{children}</View>
    </View>
  );
}

function OrderCard({
  order,
  busy,
  rejecting,
  rejectReason,
  onReasonChange,
  onAction,
  onValidate,
  onReject,
  onStartReject,
  onCancelReject,
}: {
  order: BusinessOrder;
  busy: boolean;
  rejecting: boolean;
  rejectReason: string;
  onReasonChange: (value: string) => void;
  onAction: (status: OrderStatus) => void;
  onValidate: () => void;
  onReject: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
}) {
  const router = useRouter();
  const theme = STATUS_THEME[order.status];
  const actions = actionsFor(order);
  const address = addressText(order.deliveryAddressSnapshot);
  const done = isDone(order);
  const needsAttention =
    order.status === 'pending' ||
    (order.status === 'awaiting_payment' && order.payment?.status === 'evidence_submitted');
  const showPaymentBox = Boolean(
    order.payment && (!done || order.payment.status !== 'validated'),
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.tint,
          borderColor: theme.border,
          borderLeftColor: theme.accent,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{order.code}</Text>
            <Text style={styles.waiting}>
              {done
                ? `Creado ${dateLabel(order.createdAt)}`
                : `Hace ${waitingLabel(order.createdAt)}`}
            </Text>
          </View>
          <Text style={styles.buyer}>
            {order.buyerName ?? 'Cliente'}
            {order.buyerPhone ? ` · ${order.buyerPhone}` : ''}
          </Text>
        </View>
        <View style={styles.cardHeaderBadges}>
          {needsAttention ? (
            <View style={[styles.attentionPill, { backgroundColor: theme.accent }]}>
              <Text style={styles.attentionText}>Requiere tu acción</Text>
            </View>
          ) : null}
          <StatusBadge status={order.status} />
        </View>
      </View>

      <Text style={styles.meta}>
        {order.branchName} · {order.fulfillment === 'delivery' ? 'Domicilio' : 'Recogida'} ·{' '}
        {money(order.totalCents, order.currency)} · {paymentMethodLabel(order.paymentMethod)}
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
              disabled={busy}
              onPress={() => onAction(action)}
              style={[
                styles.actionButton,
                { backgroundColor: action === 'rejected' ? 'transparent' : theme.accent },
                action === 'rejected' && styles.actionDanger,
                busy && styles.disabled,
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

      {showPaymentBox && order.payment ? (
        <View style={styles.paymentBox}>
          <View style={styles.rowBetween}>
            <Text style={styles.paymentTitle}>
              Pago · {paymentMethodLabel(order.paymentMethod)}
            </Text>
            <Text style={[styles.paymentStatus, { color: theme.accent }]}>
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
            rejecting ? (
              <View style={styles.rejectBox}>
                <TextInput
                  value={rejectReason}
                  onChangeText={onReasonChange}
                  placeholder="Motivo del rechazo"
                  placeholderTextColor="#9AA8A4"
                  style={styles.rejectInput}
                />
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={onReject}
                    style={[styles.actionDanger, styles.actionSolid]}
                  >
                    <Text style={styles.actionDangerText}>Confirmar rechazo</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={onCancelReject}
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
                  disabled={busy}
                  onPress={onValidate}
                  style={[styles.actionButton, busy && styles.disabled]}
                >
                  <Text style={styles.actionText}>Validar pago</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={onStartReject}
                  style={styles.actionDanger}
                >
                  <Text style={styles.actionDangerText}>Rechazar</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>
      ) : done ? (
        <Text style={styles.muted}>
          Pago: {paymentMethodLabel(order.paymentMethod)} ·{' '}
          {order.paymentMethod === 'transfer'
            ? paymentStatusLabel(order.paymentStatus)
            : 'contra entrega'}
        </Text>
      ) : order.paymentMethod === 'transfer' ? (
        <Text style={styles.pendingPayment}>Esperando comprobante del comprador.</Text>
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
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  refresh: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  headerBlock: { gap: 3 },
  businessName: { fontSize: 22, fontWeight: '800', color: colors.text },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#10B981' },
  liveText: { color: colors.muted, fontSize: 11 },
  summary: { color: colors.muted, fontSize: 12, marginTop: 4 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionDot: { width: 10, height: 10, borderRadius: 999 },
  sectionText: { flex: 1, gap: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  sectionSubtitle: { fontSize: 11, color: colors.muted },
  countPill: {
    minWidth: 30,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'center',
  },
  countText: { fontSize: 12, fontWeight: '800' },
  sectionCards: { gap: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.lg,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardHeaderText: { flex: 1, gap: 2 },
  cardHeaderBadges: { alignItems: 'flex-end', gap: 5 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  code: { fontSize: 13, fontWeight: '800', color: colors.brandDark, letterSpacing: 0.5 },
  waiting: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  attentionPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  attentionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  buyer: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.text, marginTop: 2 },
  items: { fontSize: 12, color: colors.text, lineHeight: 18 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14 },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  actionDanger: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  actionDangerText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  actionSolid: { backgroundColor: colors.danger, borderColor: colors.danger },
  actionNeutral: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  actionNeutralText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  pendingPayment: { color: '#92400E', fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
  paymentBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  paymentTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  paymentStatus: { fontSize: 12, fontWeight: '700' },
  evidence: {
    width: '100%',
    height: 160,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
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
  chatLink: { marginTop: spacing.sm, paddingVertical: 4 },
  chatLinkText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  showMore: { alignItems: 'center', paddingVertical: spacing.sm },
  showMoreText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  allClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  allClearIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    color: '#166534',
    textAlign: 'center',
    lineHeight: 34,
    fontSize: 18,
    fontWeight: '800',
  },
  allClearText: { flex: 1, gap: 2 },
  allClearTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
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
