import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useCart } from '../lib/cart';
import { useResponsive } from '../lib/responsive';
import { colors, layout, radius, shadows, spacing } from '../theme';
import { AppText } from './ui/app-text';
import { Icon, type IconName } from './ui/icon';

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: 'Inicio', icon: 'home-outline', activeIcon: 'home' },
  explore: { label: 'Explorar', icon: 'compass-outline', activeIcon: 'compass' },
  orders: { label: 'Pedidos', icon: 'receipt-outline', activeIcon: 'receipt' },
  cart: { label: 'Carrito', icon: 'bag-handle-outline', activeIcon: 'bag-handle' },
  settings: { label: 'Cuenta', icon: 'person-outline', activeIcon: 'person' },
};

/**
 * Barra inferior propia: flota sobre el fondo, muestra iconos rellenos al
 * estar activa y una insignia con los ítems del carrito.
 */
export function TabBar({ state, insets, navigateToTab }: BottomTabBarProps) {
  const { itemCount } = useCart();
  const { isTablet } = useResponsive();

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          paddingHorizontal: isTablet ? spacing.lg : spacing.sm,
        },
      ]}
    >
      <View style={[styles.bar, isTablet && styles.barWide]}>
        {state.routes.map((route, index) => {
          const config = TABS[route.name] ?? {
            label: route.name,
            icon: 'ellipse-outline' as IconName,
            activeIcon: 'ellipse' as IconName,
          };
          const focused = state.index === index;
          const showCount = route.name === 'cart' && itemCount > 0;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={`${config.label}${showCount ? `, ${itemCount} ítems` : ''}`}
              onPress={() => {
                if (!focused) {
                  navigateToTab(route.key);
                }
              }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Icon
                  name={focused ? config.activeIcon : config.icon}
                  size={21}
                  color={focused ? colors.brand : colors.muted}
                />
                {showCount ? (
                  <View style={styles.dot}>
                    <AppText variant="micro" color={colors.text} style={styles.dotText}>
                      {itemCount > 9 ? '9+' : itemCount}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText
                variant="caption"
                color={focused ? colors.brandDark : colors.muted}
                style={[styles.label, focused && styles.labelActive]}
                numberOfLines={1}
              >
                {config.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.bg,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: 6,
    paddingVertical: 6,
    ...shadows.floating,
    width: '100%',
    alignSelf: 'center',
    maxWidth: layout.tabBar,
  },
  barWide: { maxWidth: 600 },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    borderRadius: radius.lg,
    minHeight: 52,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.brandTint },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  labelActive: { fontWeight: '800' },
  dot: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  dotText: { fontSize: 9, lineHeight: 11, fontWeight: '800' },
});
