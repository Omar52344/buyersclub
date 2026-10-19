import { formatMoney } from '@buyersclub/core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../lib/api';
import { getGuestBranch, createGuestOrder, type GuestBranchResponse, type GuestOrderResponse } from '../lib/guest';
import { colors, radius, spacing } from '../theme';

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

function etaLabel(value: string | null): string {
  if (!value) {
    return ' lo antes posible';
  }
  return ` ~${new Date(value).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function GuestQrScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : null;

  const [data, setData] = useState<GuestBranchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<GuestOrderResponse | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!token) {
      setError('Este enlace no tiene un código QR válido.');
      setLoading(false);
      return;
    }
    let active = true;
    getGuestBranch(token)
      .then((response) => {
        if (!active) {
          return;
        }
        setData(response);
        if (!response.branch.fulfillment.pickup && response.branch.fulfillment.delivery) {
          setFulfillment('delivery');
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'No pudimos abrir esta sucursal.',
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
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const products = data?.branch.products ?? [];
  const items = products
    .map((product) => ({ product, qty: cart[product.id] ?? 0 }))
    .filter((item) => item.qty > 0);
  const subtotal = items.reduce(
    (total, item) => total + item.product.priceCents * item.qty,
    0,
  );
  const deliveryFee =
    fulfillment === 'delivery' ? data?.branch.deliveryFee.amountCents ?? 0 : 0;
  const total = subtotal + deliveryFee;
  const minDelivery = data?.branch.minOrder.amountCents ?? 0;
  const phoneDigits = phone.replace(/\D/g, '');
  const canSubmit =
    Boolean(data?.branch.isOpen) &&
    items.length > 0 &&
    name.trim().length >= 2 &&
    phoneDigits.length >= 10 &&
    (fulfillment === 'pickup' || total >= minDelivery) &&
    (fulfillment === 'pickup' || (line1.trim().length >= 5 && city.trim().length >= 2)) &&
    !submitting &&
    cooldown === 0;

  function add(productId: string) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
  }

  function remove(productId: string) {
    setCart((current) => {
      const next = { ...current };
      if ((next[productId] ?? 0) <= 1) {
        delete next[productId];
      } else {
        next[productId] = next[productId] - 1;
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!token || !data || !canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await createGuestOrder(token, {
        name: name.trim(),
        phone,
        fulfillment,
        paymentMethod: 'cash',
        items: items.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
        })),
        notes: notes.trim() || undefined,
        deliveryAddress:
          fulfillment === 'delivery'
            ? {
                line1: line1.trim(),
                city: city.trim(),
                recipientName: name.trim(),
                phone,
              }
            : undefined,
      });
      setOrder(response);
      setCooldown(60);
      setCart({});
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'No pudimos enviar el pedido. Intenta de nuevo.',
      );
      if (caught instanceof ApiError && caught.status === 429) {
        setCooldown(60);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Abriendo la tienda…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>QR no disponible</Text>
          <Text style={styles.muted}>{error ?? 'Este enlace no es válido.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>¡Pedido recibido!</Text>
            <Text style={styles.successCode}>{order.order.code}</Text>
            <Text style={styles.muted}>
              {order.order.business.name} · {order.order.branch.name}
            </Text>
            <Text style={styles.successTotal}>
              {money(order.order.totalCents, order.order.currency)}
            </Text>
            <Text style={styles.muted}>
              {order.order.fulfillment === 'pickup'
                ? 'Recoges en la tienda'
                : 'Entrega a domicilio'}
              {etaLabel(order.order.etaAt)}
            </Text>
            <View style={styles.successNote}>
              <Text style={styles.successNoteText}>
                Muestra el código {order.order.code} en la tienda. Pagas al recibir
                (efectivo o datáfono).
              </Text>
            </View>
          </View>

          {cooldown > 0 ? (
            <Text style={styles.cooldown}>
              Puedes volver a pedir en {cooldown} s.
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setOrder(null)}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Hacer otro pedido</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Pedido rápido · sin registro</Text>
            <Text style={styles.title}>{data.branch.business.name}</Text>
            <Text style={styles.subtitle}>
              {data.branch.name} · {data.branch.addressLine}, {data.branch.city}
            </Text>
            <Text style={[styles.open, !data.branch.isOpen && styles.closed]}>
              {data.branch.isOpen ? '● Abierto ahora' : '● Cerrado en este momento'}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Elige tus productos</Text>
            {products.length === 0 ? (
              <Text style={styles.muted}>
                Esta sucursal no tiene productos disponibles ahora.
              </Text>
            ) : (
              products.map((product) => {
                const qty = cart[product.id] ?? 0;
                return (
                  <View key={product.id} style={styles.productRow}>
                    <View style={styles.productText}>
                      <Text style={styles.productName}>{product.name}</Text>
                      {product.description ? (
                        <Text style={styles.muted}>{product.description}</Text>
                      ) : null}
                      <Text style={styles.productPrice}>
                        {money(product.priceCents, data.branch.business.currency)}
                      </Text>
                    </View>
                    <View style={styles.qtyRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar ${product.name}`}
                        onPress={() => remove(product.id)}
                        style={[styles.qtyButton, qty === 0 && styles.disabled]}
                        disabled={qty === 0}
                      >
                        <Text style={styles.qtyButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.qty}>{qty}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Agregar ${product.name}`}
                        onPress={() => add(product.id)}
                        style={styles.qtyButton}
                      >
                        <Text style={styles.qtyButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tus datos</Text>
            <Text style={styles.helper}>
              No necesitas crear una cuenta. Solo tu nombre y celular para avisarte.
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nombre"
              placeholderTextColor="#9AA8A4"
              autoCapitalize="words"
              style={styles.input}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Celular de 10 dígitos"
              placeholderTextColor="#9AA8A4"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>¿Cómo lo recibes?</Text>
            <View style={styles.chips}>
              {data.branch.fulfillment.pickup ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFulfillment('pickup')}
                  style={[styles.chip, fulfillment === 'pickup' && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      fulfillment === 'pickup' && styles.chipTextSelected,
                    ]}
                  >
                    Recoger en tienda
                  </Text>
                </Pressable>
              ) : null}
              {data.branch.fulfillment.delivery ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFulfillment('delivery')}
                  style={[styles.chip, fulfillment === 'delivery' && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      fulfillment === 'delivery' && styles.chipTextSelected,
                    ]}
                  >
                    Domicilio
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {fulfillment === 'delivery' ? (
              <>
                <TextInput
                  value={line1}
                  onChangeText={setLine1}
                  placeholder="Dirección (calle, número)"
                  placeholderTextColor="#9AA8A4"
                  style={styles.input}
                />
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="Ciudad"
                  placeholderTextColor="#9AA8A4"
                  style={styles.input}
                />
              </>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notas (opcional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Ej. sin cebolla, timbre 2"
              placeholderTextColor="#9AA8A4"
              multiline
              style={[styles.input, styles.multiline]}
            />
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.muted}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                {money(subtotal, data.branch.business.currency)}
              </Text>
            </View>
            {deliveryFee > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.muted}>Domicilio</Text>
                <Text style={styles.summaryValue}>
                  {money(deliveryFee, data.branch.business.currency)}
                </Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTitle}>Total</Text>
              <Text style={styles.summaryTotal}>
                {money(total, data.branch.business.currency)}
              </Text>
            </View>
            {fulfillment === 'delivery' && subtotal > 0 && subtotal < minDelivery ? (
              <Text style={styles.warning}>
                El mínimo para domicilio es{' '}
                {money(minDelivery, data.branch.business.currency)}.
              </Text>
            ) : null}
            <Text style={styles.helper}>
              Pagas al recibir: efectivo o datáfono en la tienda.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={() => void handleSubmit()}
              style={[styles.primary, !canSubmit && styles.disabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>
                  {cooldown > 0
                    ? `Espera ${cooldown} s`
                    : 'Enviar pedido'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing.xl,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  hero: {
    backgroundColor: colors.brandDark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  eyebrow: { color: '#99F6E4', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#CCFBF1', fontSize: 13, lineHeight: 19 },
  open: { color: '#A7F3D0', fontSize: 12, fontWeight: '700', marginTop: 4 },
  closed: { color: '#FCA5A5' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  productText: { flex: 1, gap: 2 },
  productName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  productPrice: { color: colors.text, fontSize: 13, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  qtyButtonText: { color: colors.brandDark, fontSize: 18, fontWeight: '700' },
  qty: { minWidth: 18, textAlign: 'center', color: colors.text, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.bg,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF' },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  summaryTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  summaryTotal: { color: colors.text, fontSize: 20, fontWeight: '800' },
  warning: { color: '#B45309', fontSize: 12, fontWeight: '700' },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    color: '#166534',
    textAlign: 'center',
    lineHeight: 56,
    fontSize: 28,
    fontWeight: '800',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  successCode: { fontSize: 18, fontWeight: '800', color: colors.brandDark, letterSpacing: 1 },
  successTotal: { fontSize: 24, fontWeight: '800', color: colors.text },
  successNote: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.md },
  successNoteText: { color: colors.brandDark, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  cooldown: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
});
