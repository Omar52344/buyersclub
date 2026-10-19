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
  listNotifications,
  markNotificationsRead,
  type AppNotification,
} from '../lib/notifications';
import { colors, radius, spacing } from '../theme';

function dateLabel(value: string): string {
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function targetFor(item: AppNotification): string | null {
  const data = item.data as {
    deeplink?: unknown;
    orderId?: unknown;
    conversationId?: unknown;
  };
  if (typeof data.deeplink === 'string') {
    return data.deeplink;
  }
  if (typeof data.orderId === 'string') {
    return `/order?id=${data.orderId}`;
  }
  if (typeof data.conversationId === 'string') {
    return `/chat?id=${data.conversationId}`;
  }
  return null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await listNotifications());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar los avisos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleOpen(item: AppNotification) {
    if (!item.readAt) {
      await markNotificationsRead([item.id]);
    }
    const target = targetFor(item);
    if (target) {
      router.push(target);
    } else {
      await load();
    }
  }

  async function handleReadAll() {
    await markNotificationsRead();
    await load();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Notificaciones</Text>
          <Pressable accessibilityRole="button" onPress={handleReadAll}>
            <Text style={styles.link}>Marcar leídas</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.muted}>Cargando avisos…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.muted}>
              Aquí verás pedidos nuevos, cambios de estado, pagos y mensajes.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => handleOpen(item)}
              style={[styles.card, !item.readAt && styles.cardUnread]}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{item.title}</Text>
                {!item.readAt ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{dateLabel(item.createdAt)}</Text>
            </Pressable>
          ))
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
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  link: { color: colors.brand, fontWeight: '600', fontSize: 12 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  cardUnread: { borderColor: '#5EEAD4', backgroundColor: '#F0FDFA' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '800', color: colors.text, flex: 1 },
  body: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  date: { fontSize: 11, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.brand },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
