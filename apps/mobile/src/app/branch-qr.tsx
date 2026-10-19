import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../lib/api';
import { getBranchQr, type BranchQr } from '../lib/vendor';
import { colors, radius, spacing } from '../theme';

export default function BranchQrScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const branchId = typeof params.id === 'string' ? params.id : null;
  const [qr, setQr] = useState<BranchQr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) {
      setError('No encontramos la sucursal.');
      setLoading(false);
      return;
    }
    let active = true;
    getBranchQr(branchId)
      .then((response) => {
        if (active) {
          setQr(response);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof ApiError ? caught.message : 'No pudimos generar el QR.',
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
  }, [branchId]);

  async function shareLink() {
    if (!qr) {
      return;
    }
    if (Platform.OS === 'web') {
      const navigatorRef = (
        globalThis as {
          navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } };
        }
      ).navigator;
      if (navigatorRef?.clipboard) {
        await navigatorRef.clipboard.writeText(qr.url);
        setInfo('Enlace copiado al portapapeles.');
        return;
      }
    }
    await Share.share({ message: qr.url, url: qr.url });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>QR de la sucursal</Text>
          <View style={styles.spacer} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.muted}>Generando QR…</Text>
          </View>
        ) : qr ? (
          <>
            <View style={styles.qrCard}>
              <Image source={{ uri: qr.qrDataUrl }} style={styles.qrImage} />
              <Text style={styles.branchName}>{qr.branchName}</Text>
              <Text style={styles.muted}>
                Los clientes escanean este código y piden directo en esta sede, sin crear
                cuenta. Solo dejan nombre y celular.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Enlace para compartir</Text>
              <Text selectable style={styles.url}>
                {qr.url}
              </Text>
              <Text style={styles.helper}>
                Puedes imprimirlo en la mesa, mostrarlo en caja o enviarlo por WhatsApp.
              </Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void shareLink()}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>Compartir enlace</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void Linking.openURL(qr.url)}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>Abrir como cliente</Text>
                </Pressable>
              </View>
              {info ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>{info}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Abrir desde la app</Text>
              <Text selectable style={styles.url}>
                {qr.appUrl}
              </Text>
              <Text style={styles.helper}>
                Este enlace funciona en la app instalada. El QR usa la versión web para que
                también funcione en cualquier navegador.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  spacer: { width: 22 },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrImage: {
    width: 280,
    height: 280,
    maxWidth: '100%',
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
  },
  branchName: { fontSize: 20, fontWeight: '800', color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  url: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  infoBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.sm },
  infoText: { color: colors.brandDark, fontSize: 12 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
