import { formatMoney } from '@buyersclub/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, StyleSheet, View } from 'react-native';
import { StatusBadge } from '../components/status-badge';
import { AppText } from '../components/ui/app-text';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Banner } from '../components/ui/banner';
import { Button, IconButton } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Icon, type IconName } from '../components/ui/icon';
import { Screen } from '../components/ui/screen';
import { Skeleton } from '../components/ui/skeleton';
import { TopBar } from '../components/ui/header';
import { API_URL, ApiError } from '../lib/api';
import { pickImage, uploadImage } from '../lib/files';
import { ORDER_STATUS_HINTS, dateTimeLabel, timeLabel } from '../lib/format';
import { cancelOrder, getOrder, type OrderDetail, type OrderStatus } from '../lib/orders';
import { submitPaymentEvidence } from '../lib/payments';
import { useResponsive } from '../lib/responsive';
import { colors, radius, spacing } from '../theme';

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

const FINAL: OrderStatus[] = ['completed', 'cancelled', 'rejected'];

type StepKey = 'received' | 'accepted' | 'preparing' | 'onTheWay' | 'done';

export default function OrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const { isTablet } = useResponsive();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setError('No encontramos el pedido.');
      setLoading(false);
      return;
    }
    try {
      setOrder(await getOrder(id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar el pedido.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function handleEvidence() {
    if (!order) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uri = await pickImage();
      if (!uri) {
        return;
      }
      const file = await uploadImage(uri);
      const updated = await submitPaymentEvidence(order.id, file.id, 'Comprobante de transferencia');
      setOrder(updated);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos subir el comprobante.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']} maxWidth={760} contentContainerStyle={styles.loading}>
        <TopBar title="Pedido" />
        <Skeleton width="100%" height={150} radiusSize={radius.xl} />
        <Skeleton width="100%" height={90} radiusSize={radius.lg} />
        <Skeleton width="100%" height={160} radiusSize={radius.lg} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen edges={['top', 'bottom']} maxWidth={560}>
        <TopBar title="Pedido" />
        <EmptyState
          icon="receipt-outline"
          title="No encontramos el pedido"
          description={error ?? 'Puede que el enlace haya expirado.'}
          actionLabel="Ir a mis pedidos"
          actionIcon="receipt-outline"
          onAction={() => router.replace('/orders')}
        />
      </Screen>
    );
  }

  const address = order.deliveryAddress;
  const cancelled = order.status === 'cancelled' || order.status === 'rejected';
  const steps = buildSteps(order);
  const currentIndex = stepIndex(order.status);

  return (
    <Screen
      edges={['top', 'bottom']}
      maxWidth={820}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
      <TopBar
        title={order.code}
        right={
          <IconButton icon="refresh-outline" label="Actualizar pedido" onPress={() => void load()} />
        }
      />

      <View
        style={[
          styles.hero,
          cancelled && styles.heroDanger,
          order.status === 'completed' && styles.heroSuccess,
        ]}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Icon name={statusIcon(order.status)} size={26} color={colors.onBrand} />
          </View>
          <View style={styles.flex}>
            <AppText variant="caption" color={colors.brandSoft}>
              {order.business.name}
            </AppText>
            <AppText variant="h1" color={colors.onBrand}>
              {statusTitle(order.status, order.fulfillment)}
            </AppText>
          </View>
          <StatusBadge status={order.status} />
        </View>
        <AppText variant="body" color={colors.onBrandMuted}>
          {statusHint(order.status, order.fulfillment)}
        </AppText>
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaItem}>
            <Icon name="time-outline" size={14} color={colors.brandSoft} />
            <AppText variant="caption" color={colors.brandSoft}>
              {order.etaAt ? `Entrega estimada ${timeLabel(order.etaAt)}` : dateTimeLabel(order.createdAt)}
            </AppText>
          </View>
          <View style={styles.heroMetaItem}>
            <Icon
              name={order.fulfillment === 'delivery' ? 'bicycle-outline' : 'walk-outline'}
              size={14}
              color={colors.brandSoft}
            />
            <AppText variant="caption" color={colors.brandSoft}>
              {order.fulfillment === 'delivery' ? 'A domicilio' : 'Recogida'}
            </AppText>
          </View>
        </View>
      </View>

      {error ? <Banner tone="warning" message={error} /> : null}

      {!cancelled ? (
        <Card variant="outline" style={styles.trackerCard} padding={18}>
          <AppText variant="h3">Seguimiento</AppText>
          <View style={styles.tracker}>
            {steps.map((step, index) => {
              const done = index < currentIndex;
              const active = index === currentIndex;
              return (
                <View key={step.key} style={styles.stepWrap}>
                  {index > 0 ? (
                    <View
                      style={[styles.stepLine, index <= currentIndex && styles.stepLineDone]}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.stepDot,
                      done && styles.stepDotDone,
                      active && styles.stepDotActive,
                    ]}
                  >
                    {done ? (
                      <Icon name="checkmark" size={12} color={colors.onBrand} />
                    ) : (
                      <AppText
                        variant="micro"
                        color={active ? colors.onBrand : colors.subtle}
                        style={styles.stepNumber}
                      >
                        {index + 1}
                      </AppText>
                    )}
                  </View>
                  <AppText
                    variant="caption"
                    color={active ? colors.brandDark : done ? colors.textSoft : colors.subtle}
                    align="center"
                    style={[styles.stepLabel, active && styles.stepLabelActive]}
                    numberOfLines={2}
                  >
                    {step.label}
                  </AppText>
                </View>
              );
            })}
          </View>
          {order.events.length > 0 ? (
            <View style={styles.lastEvent}>
              <Icon name="pulse-outline" size={14} color={colors.muted} />
              <AppText variant="caption" color={colors.muted}>
                Última actualización: {dateTimeLabel(order.events[order.events.length - 1]?.at)}
              </AppText>
            </View>
          ) : null}
        </Card>
      ) : (
        <Banner
          tone="danger"
          title="Pedido cancelado"
          message={order.cancelReason ?? 'Si tienes dudas, contacta a la tienda desde el chat.'}
        />
      )}

      <View style={isTablet ? styles.columns : undefined}>
        <View style={styles.column}>
          <Card variant="outline" style={styles.itemsCard} padding={18}>
            <View style={styles.cardHeader}>
              <AppText variant="h3">Productos</AppText>
              <Badge
                label={`${order.items.length} ${order.items.length === 1 ? 'ítem' : 'ítems'}`}
                tone="neutral"
              />
            </View>
            {order.items.map((item, index) => (
              <View key={item.id} style={[styles.itemRow, index > 0 && styles.divider]}>
                <View style={styles.qtyBadge}>
                  <AppText variant="micro" color={colors.brandDark}>
                    {item.qty}×
                  </AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{item.name}</AppText>
                  {item.notes ? (
                    <AppText variant="caption" color={colors.muted}>
                      {item.notes}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong">{money(item.lineTotalCents, order.currency)}</AppText>
              </View>
            ))}
            <View style={styles.totals}>
              <Row label="Subtotal" value={money(order.subtotalCents, order.currency)} />
              {order.deliveryFeeCents > 0 ? (
                <Row label="Domicilio" value={money(order.deliveryFeeCents, order.currency)} />
              ) : null}
              <Row label="Total" value={money(order.totalCents, order.currency)} strong />
            </View>
          </Card>

          <Card variant="outline" style={styles.infoCard} padding={18}>
            <View style={styles.cardHeader}>
              <View style={styles.infoIcon}>
                <Icon
                  name={order.fulfillment === 'delivery' ? 'bicycle-outline' : 'walk-outline'}
                  size={18}
                  color={colors.brand}
                />
              </View>
              <AppText variant="h3">
                {order.fulfillment === 'delivery' ? 'Entrega a domicilio' : 'Recogida en tienda'}
              </AppText>
            </View>
            {order.fulfillment === 'delivery' && address ? (
              <View style={styles.addressBlock}>
                <AppText variant="bodyStrong">{address.line1 ?? 'Dirección de entrega'}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {[address.city, address.notes].filter(Boolean).join(' · ')}
                </AppText>
                {address.recipientName ? (
                  <AppText variant="caption" color={colors.muted}>
                    Recibe: {address.recipientName}
                    {address.phone ? ` · ${address.phone}` : ''}
                  </AppText>
                ) : null}
              </View>
            ) : (
              <View style={styles.addressBlock}>
                <AppText variant="bodyStrong">
                  {order.branch.name} · {order.branch.addressLine}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {order.branch.city}. Te avisaremos cuando esté listo para recoger.
                </AppText>
                {order.branch.phone ? (
                  <AppText variant="caption" color={colors.muted}>
                    Tel. {order.branch.phone}
                  </AppText>
                ) : null}
              </View>
            )}
            {order.notes ? (
              <View style={styles.addressBlock}>
                <AppText variant="caption" color={colors.muted}>
                  Nota para la tienda: {order.notes}
                </AppText>
              </View>
            ) : null}
          </Card>

          <Card variant="outline" style={styles.infoCard} padding={18}>
            <View style={styles.cardHeader}>
              <View style={styles.infoIcon}>
                <Icon name="wallet-outline" size={18} color={colors.brand} />
              </View>
              <AppText variant="h3">Pago</AppText>
              <Badge
                label={paymentStatusLabel(order.paymentStatus)}
                tone={paymentTone(order.paymentStatus)}
              />
            </View>
            <AppText variant="body" color={colors.textSoft}>
              {paymentMethodLabel(order.paymentMethod)}
              {order.payment?.note ? ` · ${order.payment.note}` : ''}
            </AppText>

            {order.payment?.evidenceUrl ? (
              <View style={styles.evidenceWrap}>
                <Image
                  source={{ uri: `${API_URL}${order.payment.evidenceUrl}` }}
                  style={styles.evidenceImage}
                  resizeMode="cover"
                />
                <Badge
                  label={
                    order.paymentStatus === 'validated' ? 'Comprobante validado' : 'Comprobante enviado'
                  }
                  tone={order.paymentStatus === 'validated' ? 'success' : 'info'}
                  icon={order.paymentStatus === 'validated' ? 'checkmark-circle' : 'time'}
                  style={styles.evidenceBadge}
                />
              </View>
            ) : null}

            {order.payment?.rejectionReason ? (
              <Banner
                tone="danger"
                title="Comprobante rechazado"
                message={order.payment.rejectionReason}
              />
            ) : null}

            {order.viewer === 'buyer' &&
            order.paymentMethod === 'transfer' &&
            (order.paymentStatus === 'pending' || order.paymentStatus === 'rejected') &&
            !FINAL.includes(order.status) ? (
              <Button
                label={
                  order.paymentStatus === 'rejected'
                    ? 'Subir un nuevo comprobante'
                    : 'Subir comprobante de pago'
                }
                onPress={handleEvidence}
                loading={uploading}
                disabled={uploading}
                icon="cloud-upload-outline"
                variant="soft"
                size="sm"
              />
            ) : null}

            {order.paymentStatus === 'evidence_submitted' ? (
              <Banner
                tone="info"
                message="La tienda está revisando tu comprobante. Te avisaremos cuando lo valide."
              />
            ) : null}
          </Card>
        </View>

        <View style={styles.column}>
          {order.conversationId ? (
            <Card
              onPress={() =>
                router.push({ pathname: '/chat', params: { id: order.conversationId! } })
              }
              variant="brand"
              padding={18}
              accessibilityLabel="Abrir chat con la tienda"
            >
              <View style={styles.chatRow}>
                <View style={styles.chatIcon}>
                  <Icon name="chatbubbles-outline" size={22} color={colors.onBrand} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="h3" color={colors.onBrand}>
                    Chat con la tienda
                  </AppText>
                  <AppText variant="caption" color={colors.onBrandMuted}>
                    Coordina la entrega, el pago o cualquier detalle.
                  </AppText>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.brandSoft} />
              </View>
            </Card>
          ) : null}

          <Card variant="outline" style={styles.summaryCard} padding={18}>
            <View style={styles.summaryRow}>
              <Avatar name={order.business.name} size={40} square />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{order.business.name}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {order.branch.name}
                </AppText>
              </View>
            </View>
            <View style={styles.summaryMeta}>
              <SummaryLine icon="receipt-outline" label="Pedido" value={order.code} />
              <SummaryLine icon="calendar-outline" label="Creado" value={dateTimeLabel(order.createdAt)} />
              {order.acceptedAt ? (
                <SummaryLine icon="checkmark-outline" label="Aceptado" value={dateTimeLabel(order.acceptedAt)} />
              ) : null}
            </View>
          </Card>

          {order.canCancel ? (
            <Card variant="outline" style={styles.cancelCard} padding={18}>
              <AppText variant="bodyStrong">¿Algo salió mal?</AppText>
              <AppText variant="caption" color={colors.muted}>
                Puedes cancelar mientras la tienda no haya iniciado la preparación.
              </AppText>
              {confirming ? (
                <View style={styles.cancelActions}>
                  <Button
                    label={busy ? 'Cancelando…' : 'Sí, cancelar pedido'}
                    onPress={handleCancel}
                    variant="danger"
                    loading={busy}
                    disabled={busy}
                    size="sm"
                  />
                  <Button
                    label="No, mantener"
                    onPress={() => setConfirming(false)}
                    variant="secondary"
                    size="sm"
                  />
                </View>
              ) : (
                <Button
                  label="Cancelar pedido"
                  onPress={() => setConfirming(true)}
                  variant="dangerSoft"
                  size="sm"
                />
              )}
            </Card>
          ) : null}

          <Button
            label="Volver a mis pedidos"
            onPress={() => router.push('/orders')}
            variant="secondary"
            icon="receipt-outline"
          />
        </View>
      </View>
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant={strong ? 'h3' : 'body'} color={strong ? colors.text : colors.muted}>
        {label}
      </AppText>
      <AppText variant={strong ? 'h3' : 'bodyStrong'}>{value}</AppText>
    </View>
  );
}

function SummaryLine({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Icon name={icon} size={14} color={colors.muted} />
      <AppText variant="caption" color={colors.muted} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="caption" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

function statusTitle(status: OrderStatus, fulfillment: 'delivery' | 'pickup'): string {
  switch (status) {
    case 'pending':
      return 'Pedido recibido';
    case 'awaiting_payment':
      return 'Esperando pago';
    case 'accepted':
      return 'Pedido aceptado';
    case 'preparing':
      return 'Preparando tu pedido';
    case 'ready':
      return fulfillment === 'pickup' ? 'Listo para recoger' : 'Listo para enviar';
    case 'out_for_delivery':
      return 'Va en camino';
    case 'completed':
      return fulfillment === 'delivery' ? '¡Entregado!' : '¡Recogido!';
    case 'cancelled':
      return 'Pedido cancelado';
    case 'rejected':
      return 'Pedido rechazado';
    default:
      return 'Tu pedido';
  }
}

function statusHint(status: OrderStatus, fulfillment: 'delivery' | 'pickup'): string {
  if (status === 'ready') {
    return fulfillment === 'pickup'
      ? 'Tu pedido está listo. ¡Ya puedes recogerlo!'
      : 'Tu pedido está listo y saldrá pronto a entrega.';
  }
  if (status === 'completed') {
    return fulfillment === 'pickup'
      ? 'Pedido recogido. ¡Gracias por tu compra!'
      : 'Pedido entregado. ¡Buen provecho!';
  }
  return ORDER_STATUS_HINTS[status];
}

function statusIcon(status: OrderStatus): IconName {
  switch (status) {
    case 'completed':
      return 'checkmark-done';
    case 'cancelled':
    case 'rejected':
      return 'close-circle';
    case 'out_for_delivery':
      return 'bicycle';
    case 'ready':
      return 'bag-check';
    case 'preparing':
      return 'restaurant';
    case 'accepted':
      return 'thumbs-up';
    case 'awaiting_payment':
      return 'wallet';
    default:
      return 'receipt';
  }
}

function stepIndex(status: OrderStatus): number {
  switch (status) {
    case 'pending':
    case 'awaiting_payment':
      return 0;
    case 'accepted':
      return 1;
    case 'preparing':
      return 2;
    case 'ready':
    case 'out_for_delivery':
      return 3;
    case 'completed':
      return 4;
    default:
      return -1;
  }
}

function buildSteps(order: OrderDetail): { key: StepKey; label: string }[] {
  const pickup = order.fulfillment === 'pickup';
  return [
    { key: 'received', label: 'Recibido' },
    { key: 'accepted', label: 'Aceptado' },
    { key: 'preparing', label: 'Preparando' },
    { key: 'onTheWay', label: pickup ? 'Listo' : 'Listo para salir' },
    { key: 'done', label: pickup ? 'Recogido' : 'Entregado' },
  ];
}

function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return 'Efectivo';
    case 'card_terminal':
      return 'Datáfono';
    case 'transfer':
      return 'Transferencia';
    default:
      return 'Otro medio';
  }
}

function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'validated':
      return 'Pago validado';
    case 'evidence_submitted':
      return 'En revisión';
    case 'rejected':
      return 'Rechazado';
    case 'refunded':
      return 'Reembolsado';
    default:
      return 'Pago pendiente';
  }
}

function paymentTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'validated':
      return 'success';
    case 'evidence_submitted':
      return 'info';
    case 'rejected':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

const styles = StyleSheet.create({
  loading: { paddingTop: spacing.md, gap: spacing.md },
  content: { paddingTop: 0, gap: spacing.md },
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroDanger: { backgroundColor: colors.dangerDark },
  heroSuccess: { backgroundColor: colors.successDark },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 2 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trackerCard: { gap: spacing.md },
  tracker: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  stepWrap: { flex: 1, alignItems: 'center', gap: 5, position: 'relative' },
  stepLine: {
    position: 'absolute',
    top: 13,
    right: '50%',
    left: '-50%',
    height: 3,
    backgroundColor: colors.border,
  },
  stepLineDone: { backgroundColor: colors.brand },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepDotDone: { backgroundColor: colors.brand, borderColor: colors.brand },
  stepDotActive: { backgroundColor: colors.brand, borderColor: colors.brandSoft },
  stepNumber: { fontSize: 10 },
  stepLabel: { fontSize: 10, lineHeight: 13 },
  stepLabelActive: { fontWeight: '800' },
  lastEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  column: { flex: 1, gap: spacing.md },
  itemsCard: { gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4 },
  qtyBadge: {
    minWidth: 30,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
  },
  totals: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 7, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  infoCard: { gap: spacing.sm },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBlock: { gap: 2 },
  evidenceWrap: { gap: 6 },
  evidenceImage: {
    width: '100%',
    height: 190,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  evidenceBadge: { alignSelf: 'flex-start' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryMeta: { gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancelCard: { gap: spacing.sm },
  cancelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
