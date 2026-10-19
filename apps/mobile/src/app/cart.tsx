import { formatMoney } from '@buyersclub/core';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../lib/cart';
import { ApiError } from '../lib/api';
import type { CurrencyCode } from '../lib/discovery';
import { createOrder, type PaymentMethod } from '../lib/orders';
import { colors, radius, spacing } from '../theme';

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'No pudimos crear el pedido. Revisa tu conexión.';
}

export default function CartScreen() {
  const router = useRouter();
  const { cart, itemCount, subtotalCents, setQty, clear } = useCart();

  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>(
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

  useEffect(() => {
    if (!cart) {
      return;
    }
    setFulfillment((current) => {
      if (current === 'delivery' && !cart.fulfillment.delivery) {
        return 'pickup';
      }
      if (current === 'pickup' && !cart.fulfillment.pickup) {
        return 'delivery';
      }
      return current;
    });
  }, [cart]);

  if (!cart || itemCount === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.emptyContent}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>← Volver</Text>
          </Pressable>
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.muted}>
            Explora las tiendas cercanas y agrega productos de una sucursal.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/explore')}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Explorar tiendas</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const deliveryFee = fulfillment === 'delivery' ? cart.deliveryFeeCents : 0;
  const total = subtotalCents + deliveryFee;
  const belowMinimum =
    fulfillment === 'delivery' && subtotalCents < cart.minOrderCents;
  const canDeliver = cart.fulfillment.delivery;
  const canPickup = cart.fulfillment.pickup;

  async function handleSubmit() {
    if (!cart) {
      return;
    }
    setError(null);

    if (fulfillment === 'delivery' && (line1.trim().length < 5 || city.trim().length < 2)) {
      setError('Completa la dirección y la ciudad para el domicilio.');
      return;
    }
    if (belowMinimum) {
      setError(
        `El mínimo para domicilio es ${money(cart.minOrderCents, cart.currency)}. Agrega más productos.`,
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
                notes: notes.trim() || undefined,
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Tu carrito</Text>
          <Text style={styles.count}>{itemCount} ítems</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{cart.businessName}</Text>
          <Text style={styles.muted}>{cart.branchName}</Text>
          {cart.items.map((item) => (
            <View key={item.productId} style={styles.itemRow}>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.muted}>
                  {money(item.unitPriceCents, cart.currency)} c/u
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setQty(item.productId, item.qty - 1)}
                  style={styles.stepButton}
                >
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.qty}>{item.qty}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setQty(item.productId, item.qty + 1)}
                  style={styles.stepButton}
                >
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.lineTotal}>
                {money(item.unitPriceCents * item.qty, cart.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrega</Text>
          <View style={styles.chips}>
            {canDeliver ? (
              <Chip
                label={`Domicilio · ${money(cart.deliveryFeeCents, cart.currency)}`}
                selected={fulfillment === 'delivery'}
                onPress={() => setFulfillment('delivery')}
              />
            ) : null}
            {canPickup ? (
              <Chip
                label="Recoger en tienda"
                selected={fulfillment === 'pickup'}
                onPress={() => setFulfillment('pickup')}
              />
            ) : null}
          </View>

          {fulfillment === 'delivery' ? (
            <>
              <Field label="Dirección" value={line1} onChangeText={setLine1} placeholder="Calle 70 # 10-20" />
              <Field label="Ciudad" value={city} onChangeText={setCity} placeholder="Bogotá" />
              <Field
                label="Nombre de quien recibe (opcional)"
                value={recipient}
                onChangeText={setRecipient}
                placeholder="Ana Pérez"
              />
              <Field
                label="Teléfono (opcional)"
                value={phone}
                onChangeText={setPhone}
                placeholder="+57 300 123 4567"
                keyboardType="phone-pad"
              />
            </>
          ) : (
            <Text style={styles.muted}>
              Recoges en {cart.branchName}. Te avisaremos cuando esté listo.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pago</Text>
          <View style={styles.chips}>
            <Chip
              label="Efectivo"
              selected={paymentMethod === 'cash'}
              onPress={() => setPaymentMethod('cash')}
            />
            <Chip
              label="Datáfono"
              selected={paymentMethod === 'card_terminal'}
              onPress={() => setPaymentMethod('card_terminal')}
            />
            <Chip
              label="Otro"
              selected={paymentMethod === 'other'}
              onPress={() => setPaymentMethod('other')}
            />
            <Chip
              label="Transferencia"
              selected={paymentMethod === 'transfer'}
              onPress={() => setPaymentMethod('transfer')}
            />
          </View>
          <Text style={styles.helper}>
            El pago se coordina con la tienda. Si eliges transferencia, después subes el
            comprobante desde el detalle del pedido para que el vendedor lo valide.
          </Text>
          <Field
            label="Notas para la tienda (opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Timbre 2B, sin azúcar…"
          />
        </View>

        <View style={styles.card}>
          <Row label="Subtotal" value={money(subtotalCents, cart.currency)} />
          {deliveryFee > 0 ? (
            <Row label="Domicilio" value={money(deliveryFee, cart.currency)} />
          ) : null}
          <Row label="Total" value={money(total, cart.currency)} strong />
          {belowMinimum ? (
            <Text style={styles.warning}>
              Mínimo para domicilio {money(cart.minOrderCents, cart.currency)}. Faltan{' '}
              {money(cart.minOrderCents - subtotalCents, cart.currency)}.
            </Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy || belowMinimum}
          onPress={handleSubmit}
          style={[styles.primary, (busy || belowMinimum) && styles.primaryDisabled]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>Confirmar pedido · {money(total, cart.currency)}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA8A4"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function Chip({
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
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  emptyContent: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  count: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  stepText: { fontSize: 16, fontWeight: '700', color: colors.text },
  qty: { minWidth: 20, textAlign: 'center', fontWeight: '700', color: colors.text },
  lineTotal: { minWidth: 84, textAlign: 'right', fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  rowStrong: { fontSize: 16, fontWeight: '800', color: colors.text },
  warning: { color: '#92400E', fontSize: 12, lineHeight: 18 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
