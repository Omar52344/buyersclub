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
import {
  getBuyerAnalytics,
  rangeForDays,
  type BuyerAnalytics,
} from '../lib/analytics';
import { colors, radius, spacing } from '../theme';

const RANGES = [
  { days: 7, label: '7 días', granularity: 'day' as const },
  { days: 30, label: '30 días', granularity: 'day' as const },
  { days: 90, label: '90 días', granularity: 'week' as const },
];

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  });
}

export default function BuyerDashboardScreen() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<BuyerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const selected = RANGES.find((item) => item.days === days) ?? RANGES[1]!;
        const range = rangeForDays(days);
        const analytics = await getBuyerAnalytics({
          from: range.from,
          to: range.to,
          granularity: selected.granularity,
        });
        if (active) {
          setData(analytics);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof ApiError ? caught.message : 'No pudimos cargar tus indicadores.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [days]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Mis indicadores</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/orders')}>
            <Text style={styles.link}>Pedidos</Text>
          </Pressable>
        </View>

        <View style={styles.chips}>
          {RANGES.map((range) => (
            <Pressable
              key={range.days}
              accessibilityRole="button"
              onPress={() => setDays(range.days)}
              style={[styles.chip, days === range.days && styles.chipSelected]}
            >
              <Text style={[styles.chipText, days === range.days && styles.chipTextSelected]}>
                {range.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.muted}>Calculando tus indicadores…</Text>
          </View>
        ) : !data ? null : (
          <>
            <View style={styles.kpiGrid}>
              <Kpi label="Pedidos creados" value={String(data.ordersCreated)} />
              <Kpi label="Pedidos activos" value={String(data.activeOrders.length)} />
              {data.totalsByCurrency.map((total) => (
                <Kpi
                  key={total.currency}
                  label={`Gastado en ${total.currency}`}
                  value={money(total.spentCents, total.currency)}
                  detail={`${total.ordersCompleted} completados · promedio ${money(
                    total.avgTicketCents,
                    total.currency,
                  )}`}
                />
              ))}
            </View>

            {data.totalsByCurrency.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Aún no hay compras completadas</Text>
                <Text style={styles.muted}>
                  Explora las tiendas cercanas y haz tu primer pedido para ver tus indicadores.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/explore')}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>Explorar tiendas</Text>
                </Pressable>
              </View>
            ) : null}

            {data.activeOrders.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Pedidos activos</Text>
                {data.activeOrders.map((order) => (
                  <Pressable
                    key={order.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/order', params: { id: order.id } })}
                    style={styles.row}
                  >
                    <View style={styles.rowText}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>{order.businessName}</Text>
                        <StatusBadge status={order.status} />
                      </View>
                      <Text style={styles.muted}>
                        {order.code} · {order.branchName} · {dateLabel(order.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.rowValue}>
                      {money(order.totalCents, order.currency)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {data.totalsByCurrency.map((total) => {
              const points = data.timeseries.filter(
                (point) => point.currency === total.currency,
              );
              const max = Math.max(1, ...points.map((point) => point.spentCents));
              if (points.length === 0) {
                return null;
              }
              return (
                <View key={total.currency} style={styles.card}>
                  <Text style={styles.cardTitle}>Compras en {total.currency}</Text>
                  <View style={styles.chart}>
                    {points.map((point) => (
                      <View key={`${point.bucket}-${point.currency}`} style={styles.chartCol}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: Math.max(
                                6,
                                Math.round((point.spentCents / max) * 110),
                              ),
                            },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.chartLabels}>
                    <Text style={styles.muted}>{data.range.from}</Text>
                    <Text style={styles.muted}>{data.range.to}</Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Comercios frecuentes</Text>
              {data.frequent.length === 0 ? (
                <Text style={styles.muted}>Todavía no tienes compras completadas.</Text>
              ) : (
                data.frequent.map((entry) => (
                  <View key={`${entry.businessId}-${entry.currency}`} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{entry.businessName}</Text>
                      <Text style={styles.muted}>
                        {entry.orders} pedidos · {entry.currency}
                      </Text>
                    </View>
                    <Text style={styles.rowValue}>
                      {money(entry.spentCents, entry.currency)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {detail ? <Text style={styles.kpiDetail}>{detail}</Text> : null}
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
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  link: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF' },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  kpiGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  kpi: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  kpiLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  kpiValue: { color: colors.text, fontSize: 19, fontWeight: '800' },
  kpiDetail: { color: colors.muted, fontSize: 11 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 116,
    paddingTop: 6,
  },
  chartCol: { flex: 1, justifyContent: 'flex-end' },
  chartBar: { backgroundColor: colors.brand, borderRadius: 3, width: '100%' },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
