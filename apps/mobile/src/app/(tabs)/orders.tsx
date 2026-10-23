import { formatMoney } from '@buyersclub/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { StatusBadge, statusColor } from '../../components/status-badge';
import { AppText } from '../../components/ui/app-text';
import { Avatar } from '../../components/ui/avatar';
import { Banner } from '../../components/ui/banner';
import { IconButton } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { Screen } from '../../components/ui/screen';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { SkeletonList } from '../../components/ui/skeleton';
import { ApiError } from '../../lib/api';
import { clearSession } from '../../lib/token-store';
import { dateTimeLabel, isActiveOrder, timeLabel } from '../../lib/format';
import { getOrders, type OrderSummary } from '../../lib/orders';
import { colors, radius, spacing } from '../../theme';

type Filter = 'active' | 'all' | 'closed';

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOrders(await getOrders());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await clearSession();
        router.replace('/');
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar tus pedidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activeCount = orders.filter((order) => isActiveOrder(order.status)).length;
  const closedCount = orders.length - activeCount;

  const filtered = useMemo(() => {
    if (filter === 'active') {
      return orders.filter((order) => isActiveOrder(order.status));
    }
    if (filter === 'closed') {
      return orders.filter((order) => !isActiveOrder(order.status));
    }
    return orders;
  }, [orders, filter]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <Screen
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
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="micro" color={colors.brand} style={styles.eyebrow}>
            TUS COMPRAS
          </AppText>
          <AppText variant="h1">Mis pedidos</AppText>
          <AppText variant="body" color={colors.muted}>
            Sigue el estado en vivo y vuelve a tus compras anteriores.
          </AppText>
        </View>
        <IconButton
          icon="refresh-outline"
          label="Actualizar pedidos"
          onPress={() => {
            setRefreshing(true);
            void load();
          }}
        />
      </View>

      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Filtrar pedidos"
        options={[
          { value: 'active', label: 'En curso', count: activeCount },
          { value: 'all', label: 'Todos', count: orders.length },
          { value: 'closed', label: 'Historial', count: closedCount },
        ]}
      />

      {error ? <Banner tone="warning" message={error} /> : null}

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            error
              ? 'cloud-offline-outline'
              : filter === 'active'
                ? 'checkmark-done-outline'
                : 'receipt-outline'
          }
          title={
            error
              ? 'No pudimos cargar tus pedidos'
              : filter === 'active'
                ? 'No tienes pedidos en curso'
                : filter === 'closed'
                  ? 'Aún no hay pedidos en tu historial'
                  : 'Todavía no tienes pedidos'
          }
          description={
            error
              ? 'Revisa tu conexión y vuelve a intentarlo.'
              : filter === 'all'
                ? 'Explora las tiendas cercanas, agrega productos y confirma tu primer pedido.'
                : 'Cuando tengas pedidos en este estado aparecerán aquí.'
          }
          actionLabel={error ? 'Reintentar' : filter === 'all' ? 'Explorar tiendas' : 'Ver todos'}
          actionIcon={error ? 'refresh-outline' : filter === 'all' ? 'compass-outline' : 'list-outline'}
          onAction={() => {
            if (error) {
              void load();
            } else if (filter === 'all') {
              router.replace('/explore');
            } else {
              setFilter('all');
            }
          }}
        />
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.label} style={styles.group}>
              <AppText variant="label" color={colors.muted} style={styles.groupLabel}>
                {group.label}
              </AppText>
              {group.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPress={() => router.push({ pathname: '/order', params: { id: order.id } })}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function OrderCard({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  const active = isActiveOrder(order.status);
  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={`Pedido ${order.code}`}>
      <View style={styles.cardHeader}>
        <Avatar name={order.businessName} size={44} square />
        <View style={styles.cardTitleWrap}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {order.businessName}
          </AppText>
          <AppText variant="caption" color={colors.muted} numberOfLines={1}>
            {order.code} · {order.branchName}
          </AppText>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.metaItem}>
          <Icon
            name={order.fulfillment === 'delivery' ? 'bicycle-outline' : 'walk-outline'}
            size={14}
            color={colors.muted}
          />
          <AppText variant="caption" color={colors.muted}>
            {order.fulfillment === 'delivery' ? 'Domicilio' : 'Recogida'}
          </AppText>
        </View>
        <View style={styles.metaItem}>
          <Icon name="bag-outline" size={14} color={colors.muted} />
          <AppText variant="caption" color={colors.muted} numberOfLines={1}>
            {order.itemCount} {order.itemCount === 1 ? 'ítem' : 'ítems'}
            {order.firstItem ? ` · ${order.firstItem}` : ''}
          </AppText>
        </View>
      </View>

      {active ? (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressFor(order.status, order.fulfillment)}%`,
                  backgroundColor: statusColor(order.status),
                },
              ]}
            />
          </View>
          <AppText variant="caption" color={colors.brandDark}>
            {order.etaAt
              ? `${order.fulfillment === 'delivery' ? 'Llega' : 'Listo'} ${timeLabel(order.etaAt)}`
              : 'En curso'}
          </AppText>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <AppText variant="caption" color={colors.muted}>
          {dateTimeLabel(order.createdAt)}
        </AppText>
        <View style={styles.totalWrap}>
          <AppText variant="bodyStrong">{money(order.totalCents, order.currency)}</AppText>
          <Icon name="chevron-forward" size={16} color={colors.subtle} />
        </View>
      </View>
    </Card>
  );
}

function progressFor(status: OrderSummary['status'], fulfillment: OrderSummary['fulfillment']): number {
  const steps =
    fulfillment === 'delivery'
      ? ['pending', 'awaiting_payment', 'accepted', 'preparing', 'ready', 'out_for_delivery']
      : ['pending', 'awaiting_payment', 'accepted', 'preparing', 'ready'];
  const index = steps.indexOf(status);
  return index < 0 ? 100 : Math.round(((index + 1) / steps.length) * 100);
}

function money(cents: number, currency: 'COP' | 'USD'): string {
  return formatMoney({ amountCents: cents, currency });
}

function groupByDay(orders: OrderSummary[]): { label: string; orders: OrderSummary[] }[] {
  const map = new Map<string, OrderSummary[]>();
  for (const order of orders) {
    const date = new Date(order.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (sameDay(date, today)) {
      label = 'Hoy';
    } else if (sameDay(date, yesterday)) {
      label = 'Ayer';
    } else {
      label = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    }
    const list = map.get(label) ?? [];
    list.push(order);
    map.set(label, list);
  }
  return Array.from(map.entries()).map(([label, list]) => ({ label, orders: list }));
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.sm, gap: spacing.md },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  eyebrow: { textTransform: 'uppercase', marginBottom: 2 },
  groups: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupLabel: { textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitleWrap: { flex: 1, gap: 1 },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
  },
  totalWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
