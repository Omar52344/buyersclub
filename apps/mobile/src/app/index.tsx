import { CURRENCIES } from '@buyersclub/core';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoleCard } from '../components/role-card';
import { colors, radius, spacing } from '../theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>BC</Text>
          </View>
          <Text style={styles.brand}>BuyersClub</Text>
          <Text style={styles.tagline}>
            El mapa del comercio local. Encuentra tiendas cerca, pide y recibe donde estés.
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Precios en {CURRENCIES.join(' · ')}</Text>
          </View>
        </View>

        <View style={[styles.cards, isWide && styles.cardsWide]}>
          <RoleCard
            icon="🛒"
            title="Quiero comprar"
            description="Descubre tiendas abiertas cerca de ti, explora su catálogo y pide a domicilio o para recoger."
            cta="Registrarme como cliente"
            onPress={() => router.push('/auth?role=buyer')}
          />
          <RoleCard
            icon="🏪"
            title="Quiero vender"
            description="Crea tu empresa y sucursales, publica tu catálogo y recibe pedidos con seguimiento."
            cta="Registrarme como vendedor"
            tone="accent"
            onPress={() => router.push('/auth?role=vendor')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/explore')}
          style={styles.exploreLink}
        >
          <Text style={styles.exploreText}>Ver tiendas cerca sin cuenta</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/auth?mode=login')}
          style={styles.loginLink}
        >
          <Text style={styles.loginText}>
            Ya tengo cuenta · <Text style={styles.loginStrong}>Iniciar sesión</Text>
          </Text>
        </Pressable>

        <Text style={styles.legal}>
          Al continuar aceptas los términos de uso y la política de privacidad de BuyersClub.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.xl,
    justifyContent: 'center',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  contentWide: {
    paddingVertical: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 0.5,
  },
  brand: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    maxWidth: 560,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  cards: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  cardsWide: {
    flexDirection: 'row',
  },
  loginLink: {
    alignSelf: 'center',
    padding: spacing.sm,
  },
  exploreLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  exploreText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 14,
  },
  loginText: {
    color: colors.muted,
    fontSize: 14,
  },
  loginStrong: {
    color: colors.brand,
    fontWeight: '700',
  },
  legal: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 520,
    alignSelf: 'center',
  },
});
