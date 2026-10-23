import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RoleCard } from '../components/role-card';
import { AppText } from '../components/ui/app-text';
import { Button } from '../components/ui/button';
import { Icon, type IconName } from '../components/ui/icon';
import { Screen } from '../components/ui/screen';
import { loadSession } from '../lib/token-store';
import { useResponsive } from '../lib/responsive';
import { colors, radius, spacing } from '../theme';

const TRUST: { icon: IconName; label: string }[] = [
  { icon: 'storefront-outline', label: 'Comercios de tu zona' },
  { icon: 'cash-outline', label: 'Pago en tienda' },
  { icon: 'navigate-outline', label: 'Domicilio o recogida' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { isTablet, isDesktop } = useResponsive();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    loadSession()
      .then((session) => {
        if (active && session) {
          router.replace('/home');
          return;
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setCheckingSession(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <Screen maxWidth={1120} contentContainerStyle={styles.content} bottomInset={48}>
      <View style={styles.decorTop} pointerEvents="none" />
      <View style={styles.decorBottom} pointerEvents="none" />

      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Icon name="storefront" size={24} color={colors.onBrand} />
        </View>
        <View style={styles.brandText}>
          <AppText variant="h3">ClubSellBuy</AppText>
          <AppText variant="caption" color={colors.muted}>
            Marketplace de comercio local
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Iniciar sesión"
          onPress={() => router.push('/auth?mode=login')}
          style={({ pressed }) => [styles.loginLink, pressed && styles.pressed]}
        >
          <AppText variant="label" color={colors.brand}>
            Entrar
          </AppText>
        </Pressable>
      </View>

      <View style={[styles.heroRow, isTablet && styles.heroRowWide]}>
        <View style={styles.hero}>
          <View style={styles.eyebrow}>
            <View style={styles.eyebrowDot} />
            <AppText variant="micro" color={colors.brandDark} style={styles.eyebrowText}>
              Hecho para tu barrio
            </AppText>
          </View>

          <AppText variant={isDesktop ? 'display' : 'h1'} style={styles.headline}>
            Tu barrio,{' '}
            <AppText variant={isDesktop ? 'display' : 'h1'} color={colors.brand}>
              a un toque.
            </AppText>
          </AppText>

          <AppText variant="body" color={colors.muted} style={styles.subtitle}>
            Descubre tiendas cerca de ti, mira qué tienen disponible ahora y recibe tu pedido en
            casa o recógelo sin filas.
          </AppText>

          <View style={styles.trustRow}>
            {TRUST.map((item) => (
              <View key={item.label} style={styles.trustItem}>
                <Icon name={item.icon} size={15} color={colors.brand} />
                <AppText variant="caption" color={colors.textSoft}>
                  {item.label}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.heroActions}>
            <Button
              label="Explorar tiendas cerca"
              onPress={() => router.push('/explore')}
              icon="compass-outline"
              size="lg"
            />
          </View>

          <AppText variant="caption" color={colors.subtle} style={styles.sessionHint}>
            {checkingSession ? 'Buscando tu sesión…' : 'Sin comisiones para compradores'}
          </AppText>
        </View>

        <View style={[styles.cards, isTablet && styles.cardsWide]}>
          <RoleCard
            icon="bag-handle-outline"
            title="Quiero comprar"
            description="Encuentra tiendas abiertas, arma tu pedido y sigue cada paso en tiempo real."
            cta="Crear cuenta de cliente"
            highlights={['Catálogo actualizado', 'Chat directo con la tienda']}
            onPress={() => router.push('/auth?role=buyer')}
          />
          <RoleCard
            icon="storefront-outline"
            title="Quiero vender"
            description="Publica tu empresa y sucursales, gestiona pedidos y haz crecer tu negocio local."
            cta="Crear cuenta de vendedor"
            tone="accent"
            highlights={['Catálogo por sucursal', 'Tablero de ventas']}
            onPress={() => router.push('/auth?role=vendor')}
          />
        </View>
      </View>

      <View style={styles.legalRow}>
        <AppText variant="caption" color={colors.subtle} align="center">
          Al continuar aceptas los términos y la política de privacidad de ClubSellBuy.
        </AppText>
        <View style={styles.legalBadges}>
          <LegalPill icon="shield-checkmark-outline" label="Datos protegidos" />
          <LegalPill icon="cash-outline" label="Sin pagos en la app" />
          <LegalPill icon="globe-outline" label="Web, iOS y Android" />
        </View>
      </View>
    </Screen>
  );
}

function LegalPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.legalPill}>
      <Icon name={icon} size={13} color={colors.muted} />
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.xl, overflow: 'hidden' },
  decorTop: {
    position: 'absolute',
    top: -140,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.brandSoft,
    opacity: 0.55,
  },
  decorBottom: {
    position: 'absolute',
    bottom: -160,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.accentSoft,
    opacity: 0.5,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { flex: 1, gap: 0 },
  loginLink: {
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  heroRow: { gap: spacing.xl },
  heroRowWide: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  hero: { flex: 1.15, gap: spacing.md },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  eyebrowText: { textTransform: 'uppercase' },
  headline: { marginTop: spacing.xs },
  subtitle: { fontSize: 16, lineHeight: 24, maxWidth: 560 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 2 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  sessionHint: { marginTop: spacing.xs },
  cards: { flex: 1, gap: spacing.md },
  cardsWide: { flexDirection: 'column' },
  legalRow: { gap: spacing.md, alignItems: 'center', marginTop: spacing.md },
  legalBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  legalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
});
