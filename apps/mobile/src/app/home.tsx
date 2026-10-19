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
import { loadCurrentUser, signOut, type PublicUser } from '../lib/auth';
import { useCart } from '../lib/cart';
import { registerForPush } from '../lib/push';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen() {
  const router = useRouter();
  const { itemCount } = useCart();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadCurrentUser()
      .then((current) => {
        if (active) {
          setUser(current);
          void registerForPush().catch(() => undefined);
        }
      })
      .catch(() => {
        if (active) {
          router.replace('/');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    router.replace('/');
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loading}>Cargando tu cuenta…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstName = user.fullName?.trim().split(' ')[0];
  const isVendor = user.roles.includes('vendor_owner');
  const phoneBadge =
    user.phoneVerificationMethod === 'sms'
      ? 'Verificado por SMS'
      : user.phoneVerifiedAt
        ? 'Registrado · SMS pendiente'
        : 'Sin verificar';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>BC</Text>
            </View>
            <Text style={styles.brand}>BuyersClub</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={handleSignOut}
            style={styles.signOut}
          >
            <Text style={styles.signOutText}>Salir</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.hello}>Hola{firstName ? `, ${firstName}` : ''} 👋</Text>
          <Text style={styles.heroText}>
            Tu cuenta ya está verificada. Estás dentro de la Fase 1 de BuyersClub.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tu cuenta</Text>
          <Row label="Correo" value={user.email} badge="Verificado" good />
          <Row
            label="Celular"
            value={user.phone}
            badge={phoneBadge}
            good={user.phoneVerificationMethod === 'sms'}
          />
          <View style={styles.rolesRow}>
            {user.roles.map((role) => (
              <View key={role} style={styles.roleChip}>
                <Text style={styles.roleText}>{role === 'buyer' ? 'Comprador' : 'Vendedor'}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/explore')}
          style={({ pressed }) => [styles.exploreCta, pressed && styles.exploreCtaPressed]}
        >
          <View style={styles.vendorCtaText}>
            <Text style={styles.exploreTitle}>Explorar tiendas cerca</Text>
            <Text style={styles.exploreSubtitle}>
              Catálogo, distancia y estado abierto en tiempo real
            </Text>
          </View>
          <Text style={styles.exploreArrow}>→</Text>
        </Pressable>

        <View style={styles.quickRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/orders')}
            style={styles.quickCard}
          >
            <Text style={styles.quickTitle}>Mis pedidos</Text>
            <Text style={styles.quickText}>Estado y seguimiento</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/cart')}
            style={styles.quickCard}
          >
            <Text style={styles.quickTitle}>Carrito</Text>
            <Text style={styles.quickText}>{itemCount} ítems</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/notifications')}
          style={styles.quickCardWide}
        >
          <Text style={styles.quickTitle}>Notificaciones</Text>
          <Text style={styles.quickText}>Pedidos, pagos y mensajes</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/my-dashboard')}
          style={styles.quickCardWide}
        >
          <Text style={styles.quickTitle}>Mis indicadores</Text>
          <Text style={styles.quickText}>Gasto, pedidos completados y comercios frecuentes</Text>
        </Pressable>

        {isVendor ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/vendor-dashboard')}
            style={styles.quickCardWide}
          >
            <Text style={styles.quickTitle}>Dashboard de ventas</Text>
            <Text style={styles.quickText}>Consolidado por sucursal y filtros de fecha</Text>
          </Pressable>
        ) : null}

        {isVendor ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/vendor')}
            style={({ pressed }) => [styles.vendorCta, pressed && styles.vendorCtaPressed]}
          >
            <View style={styles.vendorCtaText}>
              <Text style={styles.vendorCtaTitle}>Mi negocio</Text>
              <Text style={styles.vendorCtaSubtitle}>
                Crea tu empresa, sucursales y catálogo
              </Text>
            </View>
            <Text style={styles.vendorArrow}>→</Text>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isVendor ? 'Tu negocio, en 3 pasos' : 'Tu mapa, en 3 pasos'}
          </Text>
          <Step
            number="1"
            title={isVendor ? 'Crea tu empresa y sucursales' : 'Explora las tiendas cercanas'}
            detail={
              isVendor
                ? 'Nombre, categoría, dirección y horarios. El mapa mostrará tu estado abierto o cerrado.'
                : 'Verás los comercios de tu zona, su catálogo y si están abiertos.'
            }
          />
          <Step
            number="2"
            title={isVendor ? 'Publica tu catálogo' : 'Pide a domicilio o recoge'}
            detail={
              isVendor
                ? 'Productos compartidos entre sucursales o con precios propios por sede.'
                : 'Carrito, checkout y seguimiento del pedido en tiempo real.'
            }
          />
          <Step
            number="3"
            title={isVendor ? 'Recibe y valida pedidos' : 'Chatea y confirma tu pago'}
            detail={
              isVendor
                ? 'Órdenes por sucursal, validación de pagos y tablero de ventas.'
                : 'Habla con la tienda, sube tu comprobante y mira tu historial.'
            }
          />
          <View style={styles.nextTag}>
            <Text style={styles.nextTagText}>Siguiente: Fase 2 · vendedor y catálogo</Text>
          </View>
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Fase 2 en curso</Text>
          <Text style={styles.footerText}>
            Registro con contraseña, verificación por códigos y sesión segura. Ahora puedes crear
            tu empresa, sucursales con horario y catálogo compartido entre sedes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  badge,
  good,
}: {
  label: string;
  value: string;
  badge: string;
  good: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <View style={[styles.badge, good ? styles.badgeGood : styles.badgeWarn]}>
        <Text style={[styles.badgeText, good ? styles.badgeTextGood : styles.badgeTextWarn]}>
          {badge}
        </Text>
      </View>
    </View>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loading: { color: colors.muted, fontSize: 14 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  brand: { fontSize: 17, fontWeight: '800', color: colors.text },
  signOut: { paddingVertical: 8, paddingHorizontal: 12 },
  signOutText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  hero: { gap: spacing.xs, marginTop: spacing.sm },
  hello: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  heroText: { fontSize: 15, lineHeight: 22, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  vendorCta: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  exploreCta: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  exploreCtaPressed: { opacity: 0.9 },
  exploreTitle: { color: colors.brandDark, fontSize: 17, fontWeight: '800' },
  exploreSubtitle: { color: colors.brandDark, fontSize: 13, opacity: 0.85 },
  exploreArrow: { color: colors.brandDark, fontSize: 22, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: spacing.md },
  quickCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  quickTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  quickText: { color: colors.muted, fontSize: 12 },
  quickCardWide: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  vendorCtaPressed: { backgroundColor: colors.brandDark },
  vendorCtaText: { flex: 1, gap: 2 },
  vendorCtaTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  vendorCtaSubtitle: { color: '#D1FAE5', fontSize: 13 },
  vendorArrow: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  rowText: { flexShrink: 1, gap: 2 },
  rowLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  rowValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeGood: { backgroundColor: '#DCFCE7' },
  badgeWarn: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextGood: { color: '#166534' },
  badgeTextWarn: { color: '#92400E' },
  rolesRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  roleChip: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  roleText: { color: colors.brandDark, fontSize: 12, fontWeight: '700' },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: colors.brandDark, fontWeight: '800', fontSize: 13 },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  stepDetail: { fontSize: 13, lineHeight: 19, color: colors.muted },
  nextTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  nextTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  footerCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  footerTitle: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
  footerText: { color: colors.brandDark, fontSize: 13, lineHeight: 19 },
});
