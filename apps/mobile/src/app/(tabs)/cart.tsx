import { formatMoney } from '@buyersclub/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/ui/app-text';
import { Banner } from '../../components/ui/banner';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon, type IconName } from '../../components/ui/icon';
import { QuantityStepper } from '../../components/ui/quantity-stepper';
import { Screen } from '../../components/ui/screen';
import { Skeleton } from '../../components/ui/skeleton';
import { TopBar } from '../../components/ui/header';
import { TextField } from '../../components/ui/text-field';
import { ApiError } from '../../lib/api';
import { loadCurrentUser, type PublicUser } from '../../lib/auth';
import { useCart } from '../../lib/cart';
import type { CurrencyCode } from '../../lib/discovery';
import { createOrder, type PaymentMethod } from '../../lib/orders';
import { colors, radius, spacing } from '../../theme';

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'No pudimos crear el pedido. Revisa tu conexión.';
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: IconName; hint: string }[] = [
  { value: 'cash', label: 'Efectivo', icon: 'cash-outline', hint: 'Pagas al recibir' },
  { value: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline', hint: 'Subes comprobante' },
  { value: 'card_terminal', label: 'Datáfono', icon: 'card-outline', hint: 'En la entrega' },
  { value: 'other', label: 'Otro', icon: 'ellipsis-horizontal', hint: 'Coordinas con la tienda' },
];

export default function CartScreen() {
  const router = useRouter();
  const { cart, ready, itemCount, subtotalCents, setQty, clear } = useCart();

  const [user, setUser] = useState<PublicUser | null>(null);
  // Preferencia del usuario; abajo se ajusta a lo que la sucursal realmente ofrece.
  const [preferredFulfillment, setPreferredFulfillment] = useState<'delivery' | 'pickup'>(
    cart?.fulfillment.delivery === false ? 'pickup' : 'delivery',
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCurrentUser()
        .then((current) => {
          if (!active) {
            return;
          }
          setUser(current);
          setProfileError(null);
          setRecipient((value) => value || current.fullName || '');
          setPhone((value) => value || current.phone || '');
        })
        .catch((caught) => {
          if (!active) {
            return;
          }
          // Sin sesión el carrito sigue siendo válido; solo avisamos de fallos reales.
          setUser(null);
          if (!(caught instanceof ApiError && caught.status === 401)) {
            setProfileError('No pudimos cargar tu perfil. Revisa tu conexión.');
          }
        });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!ready) {
    return (
      <Screen edges={['top']} maxWidth={760} contentContainerStyle={styles.content}>
        <TopBar title="Tu carrito" showBack={false} />
        <Skeleton width="100%" height={84} radiusSize={radius.lg} />
        <Skeleton width="100%" height={160} radiusSize={radius.lg} />
        <Skeleton width="100%" height={120} radiusSize={radius.lg} />
      </Screen>
    );
  }

  if (!cart || itemCount === 0) {
    return (
      <Screen edges={['top']} maxWidth={620} contentContainerStyle={styles.emptyWrap}>
        <TopBar title="Tu carrito" showBack={false} />
        <EmptyState
          icon="bag-handle-outline"
          title="Tu carrito está vacío"
          description="Explora las tiendas cercanas y agrega productos de una sucursal para empezar."
          actionLabel="Explorar tiendas"
          actionIcon="compass-outline"
          onAction={() => router.replace('/explore')}
        />
        <Card variant="plain" style={styles.emptyTip}>
          <Icon name="bulb-outline" size={20} color={colors.accentDark} />
          <AppText variant="caption" color={colors.textSoft} style={styles.flex}>
            Consejo: puedes pedir a domicilio o recoger en tienda sin costo de envío.
          </AppText>
        </Card>
      </Screen>
    );
  }

  const fulfillment =
    preferredFulfillment === 'delivery' && !cart.fulfillment.delivery
      ? 'pickup'
      : preferredFulfillment === 'pickup' && !cart.fulfillment.pickup
        ? 'delivery'
        : preferredFulfillment;
  const deliveryFee = fulfillment === 'delivery' ? cart.deliveryFeeCents : 0;
  const total = subtotalCents + deliveryFee;
  const belowMinimum = fulfillment === 'delivery' && subtotalCents < cart.minOrderCents;
  const remaining = Math.max(cart.minOrderCents - subtotalCents, 0);
  const minimumProgress = Math.min(subtotalCents / Math.max(cart.minOrderCents, 1), 1);

  async function handleSubmit() {
    if (!cart) {
      return;
    }
    setError(null);

    if (!user) {
      router.push('/auth?mode=login');
      return;
    }
    if (fulfillment === 'delivery' && (line1.trim().length < 5 || city.trim().length < 2)) {
      setError('Completa la dirección y la ciudad para el domicilio.');
      return;
    }
    if (phone.trim() && phone.replace(/\D/g, '').length < 10) {
      setError('El teléfono debe tener al menos 10 dígitos.');
      return;
    }
    if (belowMinimum) {
      setError(
        `El mínimo para domicilio es ${money(cart.minOrderCents, cart.currency)}. Agrega ${money(
          remaining,
          cart.currency,
        )} más.`,
      );
      return;
    }

    setBusy(true);
    try {
      const order = await createOrder({
        branchId: cart.branchId,
        fulfillment,
        paymentMethod,
        items: cart.items.map((item) => ({ productId: item.productId, qty: item.qty })),
        deliveryAddress:
          fulfillment === 'delivery'
            ? {
                line1: line1.trim(),
                city: city.trim(),
                recipientName: recipient.trim() || undefined,
                phone: phone.trim() || undefined,
              }
            : undefined,
        notes: notes.trim() || undefined,
        clientTotalCents: total,
      });
      clear();
      router.replace({ pathname: '/order', params: { id: order.id } });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      edges={['top']}
      maxWidth={760}
      contentContainerStyle={styles.content}
      bottomInset={spacing.xl}
      keyboardAvoiding
      footer={
        <View style={styles.footerWrap}>
          {error ? <Banner tone="danger" title="Revisa tu pedido" message={error} /> : null}
          <View style={styles.footer}>
            <View style={styles.footerInfo}>
              <AppText variant="caption" color={colors.muted}>
                Total {fulfillment === 'delivery' ? 'con envío' : 'sin envío'}
              </AppText>
              <AppText variant="h2">{money(total, cart.currency)}</AppText>
            </View>
            <Button
              label={user ? 'Confirmar pedido' : 'Inicia sesión para pedir'}
              onPress={handleSubmit}
              loading={busy}
              disabled={busy || belowMinimum}
              icon={user ? 'checkmark-circle-outline' : 'log-in-outline'}
            />
          </View>
        </View>
      }
    >
      <TopBar
        title="Tu carrito"
        showBack={false}
        right={
          confirmClear ? (
            <View style={styles.clearConfirm}>
              <Button label="Vaciar" size="sm" variant="danger" onPress={() => clear()} />
              <Button label="No" size="sm" variant="secondary" onPress={() => setConfirmClear(false)} />
            </View>
          ) : (
            <Button label="Vaciar" size="sm" variant="ghost" onPress={() => setConfirmClear(true)} />
          )
        }
      />

      {profileError ? <Banner tone="warning" message={profileError} /> : null}

      {!user && !profileError ? (
        <Banner
          tone="info"
          title="Inicia sesión para confirmar"
          message="Tu carrito se guarda en este dispositivo. Entra o crea una cuenta para completar el pedido."
        />
      ) : null}

      <Card variant="outline" style={styles.businessCard} padding={16}>
        <View style={styles.businessIcon}>
          <Icon name="storefront-outline" size={20} color={colors.brandDark} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.muted}>
            Pedido en
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {cart.businessName}
          </AppText>
          <AppText variant="caption" color={colors.muted} numberOfLines={1}>
            {cart.branchName}
          </AppText>
        </View>
        <Button label="Cambiar" size="sm" variant="ghost" onPress={() => router.push('/explore')} />
      </Card>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="h2">Productos</AppText>
          <AppText variant="caption" color={colors.muted}>
            {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
          </AppText>
        </View>
        <Card style={styles.itemsCard} padding={16}>
          {cart.items.map((item, index) => (
            <View
              key={item.productId}
              style={[styles.itemRow, index > 0 && styles.itemDivider]}
            >
              <View style={styles.itemIcon}>
                <Icon name="fast-food-outline" size={18} color={colors.brand} />
              </View>
              <View style={styles.itemText}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {item.name}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {money(item.unitPriceCents, cart.currency)} c/u
                </AppText>
                {typeof item.stock === 'number' && item.stock <= 5 ? (
                  <AppText variant="caption" color={colors.warning}>
                    Solo quedan {item.stock}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.itemActions}>
                <QuantityStepper
                  value={item.qty}
                  max={item.stock ?? 99}
                  onChange={(quantity) => setQty(item.productId, quantity)}
                />
                <AppText variant="bodyStrong" style={styles.lineTotal}>
                  {money(item.unitPriceCents * item.qty, cart.currency)}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <AppText variant="h2">Entrega</AppText>
        <View style={styles.optionGrid}>
          {cart.fulfillment.delivery ? (
            <OptionCard
              icon="bicycle-outline"
              title="A domicilio"
              hint={`Envío ${money(cart.deliveryFeeCents, cart.currency)}`}
              selected={fulfillment === 'delivery'}
              onPress={() => setPreferredFulfillment('delivery')}
            />
          ) : null}
          {cart.fulfillment.pickup ? (
            <OptionCard
              icon="walk-outline"
              title="Recoger en tienda"
              hint="Sin costo de envío"
              selected={fulfillment === 'pickup'}
              onPress={() => setPreferredFulfillment('pickup')}
            />
          ) : null}
        </View>

        {fulfillment === 'delivery' ? (
          <Card variant="outline" style={styles.formCard} padding={16}>
            <TextField
              label="Dirección"
              value={line1}
              onChangeText={setLine1}
              placeholder="Calle 70 # 10-20, apto 502"
              icon="location-outline"
              autoComplete="street-address"
            />
            <View style={styles.twoColumns}>
              <TextField
                label="Ciudad"
                value={city}
                onChangeText={setCity}
                placeholder="Bogotá"
                icon="business-outline"
                containerStyle={styles.flex}
              />
              <TextField
                label="Celular"
                value={phone}
                onChangeText={setPhone}
                placeholder="+57 300 123 4567"
                icon="call-outline"
                keyboardType="phone-pad"
                optional
                containerStyle={styles.flex}
              />
            </View>
            <TextField
              label="¿Quién recibe?"
              value={recipient}
              onChangeText={setRecipient}
              placeholder="Ana Pérez"
              icon="person-outline"
              optional
            />
          </Card>
        ) : (
          <Banner
            tone="success"
            icon="walk-outline"
            title="Recoges en la tienda"
            message={`${cart.branchName}. Te avisaremos cuando tu pedido esté listo.`}
          />
        )}

        {belowMinimum ? (
          <Card variant="plain" style={styles.minimumCard} padding={14}>
            <View style={styles.minimumHeader}>
              <Icon name="cart-outline" size={16} color={colors.warning} />
              <AppText variant="caption" color={colors.warning} style={styles.flex}>
                Faltan {money(remaining, cart.currency)} para el mínimo de domicilio
              </AppText>
            </View>
            <View style={styles.minimumTrack}>
              <View style={[styles.minimumFill, { width: `${Math.max(minimumProgress * 100, 6)}%` }]} />
            </View>
          </Card>
        ) : null}
      </View>

      <View style={styles.section}>
        <AppText variant="h2">Pago</AppText>
        <View style={styles.paymentGrid}>
          {PAYMENT_OPTIONS.map((option) => (
            <PaymentCard
              key={option.value}
              option={option}
              selected={paymentMethod === option.value}
              onPress={() => setPaymentMethod(option.value)}
            />
          ))}
        </View>
        <AppText variant="caption" color={colors.muted}>
          El pago se coordina directamente con la tienda. Si eliges transferencia, podrás subir el
          comprobante desde el detalle del pedido para que lo validen.
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="h2">Notas y resumen</AppText>
        <Card variant="outline" style={styles.formCard} padding={16}>
          <TextField
            label="Notas para la tienda"
            value={notes}
            onChangeText={setNotes}
            placeholder="Timbre 2B, sin azúcar, entregar en portería…"
            icon="create-outline"
            multiline
            optional
          />
          <View style={styles.summary}>
            <SummaryRow label="Subtotal" value={money(subtotalCents, cart.currency)} />
            {deliveryFee > 0 ? (
              <SummaryRow label="Domicilio" value={money(deliveryFee, cart.currency)} />
            ) : null}
            <View style={styles.summaryDivider} />
            <SummaryRow label="Total" value={money(total, cart.currency)} strong />
          </View>
        </Card>
      </View>

      <View style={styles.trustRow}>
        <TrustItem icon="shield-checkmark-outline" label="Sin pagos en la app" />
        <TrustItem icon="chatbubble-ellipses-outline" label="Chat con la tienda" />
        <TrustItem icon="time-outline" label="Seguimiento del pedido" />
      </View>
    </Screen>
  );
}

function OptionCard({
  icon,
  title,
  hint,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        selected && styles.optionCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <Icon name={icon} size={19} color={selected ? colors.brand : colors.muted} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={selected ? colors.brandDark : colors.text}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {hint}
        </AppText>
      </View>
      <Icon
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={selected ? colors.brand : colors.subtle}
      />
    </Pressable>
  );
}

function PaymentCard({
  option,
  selected,
  onPress,
}: {
  option: (typeof PAYMENT_OPTIONS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${option.label}. ${option.hint}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.paymentCard,
        selected && styles.optionCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.paymentTop}>
        <Icon name={option.icon} size={19} color={selected ? colors.brand : colors.muted} />
        <Icon
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={selected ? colors.brand : colors.subtle}
        />
      </View>
      <AppText variant="bodyStrong" color={selected ? colors.brandDark : colors.text}>
        {option.label}
      </AppText>
      <AppText variant="caption" color={colors.muted}>
        {option.hint}
      </AppText>
    </Pressable>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant={strong ? 'h3' : 'body'} color={strong ? colors.text : colors.muted}>
        {label}
      </AppText>
      <AppText variant={strong ? 'h3' : 'bodyStrong'}>{value}</AppText>
    </View>
  );
}

function TrustItem({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.trustItem}>
      <Icon name={icon} size={14} color={colors.muted} />
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.lg },
  emptyWrap: { paddingTop: 0, gap: spacing.lg },
  emptyTip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  clearConfirm: { flexDirection: 'row', gap: 6 },
  businessCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  businessIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  itemsCard: { gap: 0 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 2 },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, gap: 1 },
  itemActions: { alignItems: 'flex-end', gap: 5 },
  lineTotal: { fontSize: 14 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionCard: {
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionCardSelected: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: { backgroundColor: colors.surface },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  paymentCard: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  paymentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pressed: { opacity: 0.75 },
  formCard: { gap: spacing.md },
  twoColumns: { flexDirection: 'row', gap: spacing.sm },
  minimumCard: { gap: 8 },
  minimumHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  minimumTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.warningBorder, overflow: 'hidden' },
  minimumFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
  summary: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryDivider: { height: 0 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', paddingVertical: spacing.sm },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerWrap: { gap: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  footerInfo: { flex: 1, gap: 0 },
});
