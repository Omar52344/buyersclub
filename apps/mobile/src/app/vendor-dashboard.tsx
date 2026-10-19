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
import { ApiError } from '../lib/api';
import {
  getVendorAnalytics,
  rangeForDays,
  type VendorAnalytics,
} from '../lib/analytics';
import { ORDER_STATUS_LABELS } from '../lib/order-labels';
import { getMyBusinesses, type Business } from '../lib/vendor';
import { colors, radius, spacing } from '../theme';

const RANGES = [
  { days: 7, label: '7 días', granularity: 'day' as const },
  { days: 30, label: '30 días', granularity: 'day' as const },
  { days: 90, label: '90 días', granularity: 'week' as const },
];

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

export default function VendorDashboardScreen() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<VendorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const businesses = await getMyBusinesses();
        const first = businesses[0] ?? null;
        if (!active) {
          return;
        }
        setBusiness(first);
        if (!first) {
          setData(null);
          return;
        }
        const selected = RANGES.find((item) => item.days === days) ?? RANGES[1]!;
        const range = rangeForDays(days);
        const analytics = await getVendorAnalytics({
          businessId: first.id,
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
            caught instanceof ApiError ? caught.message : 'No pudimos cargar el dashboard.',
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

  const maxRevenue = Math.max(
    1,
    ...(data?.timeseries.map((point) => point.revenueCents) ?? [1]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Dashboard de ventas</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/vendor-orders')}>
            <Text style={styles.link}>Pedidos</Text>
          </Pressable>
        </View>

        {business ? (
          <View>
            <Text style={styles.businessName}>{business.name}</Text>
            <Text style={styles.muted}>Consolidado de todas las sucursales</Text>
          </View>
        ) : null}

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
            <Text style={styles.muted}>Calculando indicadores…</Text>
          </View>
        ) : !data ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Primero crea tu empresa</Text>
            <Text style={styles.muted}>Necesitas una sucursal y pedidos para ver métricas.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/vendor')}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Ir a Mi negocio</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <Kpi
                label="Ventas"
                value={money(data.summary.revenueCents, data.currency)}
                detail={
                  data.comparison.revenuePct === null
                    ? 'Sin periodo anterior'
                    : `${data.comparison.revenuePct >= 0 ? '+' : ''}${data.comparison.revenuePct}% vs. anterior`
                }
                good={(data.comparison.revenuePct ?? 0) >= 0}
              />
              <Kpi
                label="Pedidos completados"
                value={String(data.summary.ordersCompleted)}
                detail={`${data.summary.ordersCreated} creados`}
              />
              <Kpi
                label="Ticket promedio"
                value={money(data.summary.avgTicketCents, data.currency)}
                detail={`${data.summary.ordersCancelled} cancelados`}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ventas por periodo</Text>
              {data.timeseries.length === 0 ? (
                <Text style={styles.muted}>Sin ventas completadas en este rango.</Text>
              ) : (
                <>
                  <View style={styles.chart}>
                    {data.timeseries.map((point) => (
                      <View key={point.bucket} style={styles.chartCol}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: Math.max(
                                6,
                                Math.round((point.revenueCents / maxRevenue) * 120),
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
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Por sucursal</Text>
              {data.byBranch.map((branch) => (
                <View key={branch.branchId} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{branch.branchName}</Text>
                    <Text style={styles.muted}>{branch.ordersCompleted} pedidos</Text>
                  </View>
                  <Text style={styles.rowValue}>
                    {money(branch.revenueCents, data.currency)}
                  </Text>
                </View>
              ))}
              {data.byBranch.length === 0 ? (
                <Text style={styles.muted}>Aún no tienes sucursales.</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Productos más vendidos</Text>
              {data.topProducts.length === 0 ? (
                <Text style={styles.muted}>Sin ventas completadas todavía.</Text>
              ) : (
                data.topProducts.map((product) => (
                  <View key={product.productId} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{product.name}</Text>
                      <Text style={styles.muted}>{product.qty} unidades</Text>
                    </View>
                    <Text style={styles.rowValue}>
                      {money(product.revenueCents, data.currency)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estado de los pedidos</Text>
              <View style={styles.funnel}>
                {data.funnel
                  .filter((entry) => entry.count > 0)
                  .map((entry) => (
                    <View key={entry.status} style={styles.funnelItem}>
                      <Text style={styles.funnelCount}>{entry.count}</Text>
                      <Text style={styles.funnelLabel}>
                        {ORDER_STATUS_LABELS[entry.status]}
                      </Text>
                    </View>
                  ))}
              </View>
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
  good,
}: {
  label: string;
  value: string;
  detail: string;
  good?: boolean;
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={[styles.kpiDetail, good === false && styles.kpiDetailBad]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  link: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  businessName: { fontSize: 24, fontWeight: '800', color: colors.text },
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
  kpiDetail: { color: '#166534', fontSize: 11 },
  kpiDetailBad: { color: colors.danger },
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
    height: 126,
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
  rowText: { flex: 1, gap: 1 },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  funnel: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  funnelItem: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minWidth: 92,
  },
  funnelCount: { fontSize: 17, fontWeight: '800', color: colors.text },
  funnelLabel: { fontSize: 10, color: colors.muted, textAlign: 'center' },
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
