import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { AppText } from '../components/ui/app-text';
import { Banner } from '../components/ui/banner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Icon, type IconName } from '../components/ui/icon';
import { Screen } from '../components/ui/screen';
import { SegmentedControl } from '../components/ui/segmented-control';
import { SkeletonList } from '../components/ui/skeleton';
import { TopBar } from '../components/ui/header';
import { ApiError } from '../lib/api';
import { safeDeeplink } from '../lib/deeplink';
import { relativeTime } from '../lib/format';
import {
  listNotifications,
  markNotificationsRead,
  type AppNotification,
} from '../lib/notifications';
import { colors, radius, spacing, webCursor } from '../theme';

type Filter = 'all' | 'unread';

function targetFor(item: AppNotification): string | null {
  const data = item.data as {
    deeplink?: unknown;
    orderId?: unknown;
    conversationId?: unknown;
  };
  if (typeof data.deeplink === 'string') {
    return safeDeeplink(data.deeplink);
  }
  if (typeof data.orderId === 'string') {
    return `/order?id=${data.orderId}`;
  }
  if (typeof data.conversationId === 'string') {
    return `/chat?id=${data.conversationId}`;
  }
  return null;
}

function lookFor(type: string): { icon: IconName; tone: 'brand' | 'accent' | 'info' | 'success' | 'danger' } {
  if (type.includes('chat') || type.includes('message')) {
    return { icon: 'chatbubbles-outline', tone: 'info' };
  }
  if (type.includes('payment')) {
    return { icon: 'wallet-outline', tone: 'accent' };
  }
  if (type.includes('cancel') || type.includes('reject')) {
    return { icon: 'close-circle-outline', tone: 'danger' };
  }
  if (type.includes('complete') || type.includes('delivered') || type.includes('validated')) {
    return { icon: 'checkmark-circle-outline', tone: 'success' };
  }
  return { icon: 'receipt-outline', tone: 'brand' };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listNotifications());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar los avisos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((item) => !item.readAt).length;
  const visible = useMemo(
    () => (filter === 'unread' ? items.filter((item) => !item.readAt) : items),
    [items, filter],
  );

  async function handleOpen(item: AppNotification) {
    if (!item.readAt) {
      try {
        await markNotificationsRead([item.id]);
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
          ),
        );
      } catch {
        setError('No pudimos marcar el aviso como leído. Se marcará al recargar.');
      }
    }
    const target = targetFor(item);
    if (target) {
      router.push(target as never);
    }
  }

  async function handleReadAll() {
    try {
      await markNotificationsRead();
      setItems((current) =>
        current.map((entry) => ({ ...entry, readAt: entry.readAt ?? new Date().toISOString() })),
      );
      setError(null);
    } catch {
      setError('No pudimos marcar todos los avisos como leídos. Inténtalo de nuevo.');
    }
  }

  return (
    <Screen
      edges={['top', 'bottom']}
      maxWidth={720}
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
        right={
          unread > 0 ? (
            <Button label="Leer todo" size="sm" variant="ghost" onPress={handleReadAll} />
          ) : null
        }
      />

      <View style={styles.header}>
        <AppText variant="h1">Novedades</AppText>
        <AppText variant="body" color={colors.muted}>
          Pedidos, pagos y mensajes de tus tiendas.
        </AppText>
      </View>

      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Filtrar notificaciones"
        options={[
          { value: 'all', label: 'Todas', count: items.length },
          { value: 'unread', label: 'Sin leer', count: unread },
        ]}
      />

      {error ? <Banner tone="warning" message={error} /> : null}

      {loading ? (
        <SkeletonList count={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={
            error
              ? 'cloud-offline-outline'
              : filter === 'unread'
                ? 'checkmark-done-circle-outline'
                : 'notifications-off-outline'
          }
          title={
            error
              ? 'No pudimos cargar los avisos'
              : filter === 'unread'
                ? 'Estás al día'
                : 'Sin notificaciones'
          }
          description={
            error
              ? 'Revisa tu conexión y vuelve a intentarlo.'
              : filter === 'unread'
                ? 'No tienes avisos sin leer. Te avisaremos cuando algo cambie en tus pedidos.'
                : 'Aquí verás pedidos nuevos, cambios de estado, pagos y mensajes.'
          }
          actionLabel={
            error ? 'Reintentar' : filter === 'unread' ? 'Ver todas' : 'Explorar tiendas'
          }
          onAction={() => {
            if (error) {
              void load();
            } else if (filter === 'unread') {
              setFilter('all');
            } else {
              router.push('/explore');
            }
          }}
        />
      ) : (
        <View style={styles.list}>
          {visible.map((item) => {
            const look = lookFor(item.type);
            const unreadItem = !item.readAt;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.body}`}
                onPress={() => handleOpen(item)}
                style={({ pressed }) => [
                  styles.row,
                  unreadItem && styles.rowUnread,
                  pressed && styles.pressed,
                  webCursor,
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    look.tone === 'accent' && styles.iconAccent,
                    look.tone === 'info' && styles.iconInfo,
                    look.tone === 'success' && styles.iconSuccess,
                    look.tone === 'danger' && styles.iconDanger,
                  ]}
                >
                  <Icon
                    name={look.icon}
                    size={19}
                    color={
                      look.tone === 'accent'
                        ? colors.accentDark
                        : look.tone === 'info'
                          ? colors.info
                          : look.tone === 'success'
                            ? colors.success
                            : look.tone === 'danger'
                              ? colors.danger
                              : colors.brand
                    }
                  />
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <AppText
                      variant={unreadItem ? 'bodyStrong' : 'body'}
                      numberOfLines={1}
                      style={styles.flex}
                    >
                      {item.title}
                    </AppText>
                    {unreadItem ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <AppText variant="caption" color={colors.muted} numberOfLines={2}>
                    {item.body}
                  </AppText>
                  <AppText variant="caption" color={colors.subtle} style={styles.time}>
                    {relativeTime(item.createdAt)}
                  </AppText>
                </View>
                <Icon name="chevron-forward" size={16} color={colors.subtle} />
              </Pressable>
            );
          })}
        </View>
      )}

      {items.length > 0 ? (
        <Card variant="plain" style={styles.tip} padding={14}>
          <Icon name="notifications-outline" size={18} color={colors.brand} />
          <AppText variant="caption" color={colors.textSoft} style={styles.flex}>
            Activa las notificaciones push en tu dispositivo para enterarte al instante.
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  flex: { flex: 1 },
  header: { gap: 2 },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowUnread: { borderColor: colors.brandSoft, backgroundColor: colors.brandTint },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAccent: { backgroundColor: colors.accentSoft },
  iconInfo: { backgroundColor: colors.infoSoft },
  iconSuccess: { backgroundColor: colors.successSoft },
  iconDanger: { backgroundColor: colors.dangerSoft },
  body: { flex: 1, gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  time: { marginTop: 2 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
