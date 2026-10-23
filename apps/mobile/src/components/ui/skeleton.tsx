import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radiusSize?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bloque de carga con pulso suave (sin librerías externas). */
export function Skeleton({ width = '100%', height = 16, radiusSize = 8, style }: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: radiusSize, opacity },
        style,
      ]}
    />
  );
}

/** Tarjeta esqueleto con la misma silueta que los resultados reales. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={44} height={44} radiusSize={radius.md} />
        <View style={styles.lines}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={11} />
        </View>
      </View>
      {Array.from({ length: lines - 1 }).map((_, index) => (
        <Skeleton key={`line-${index}`} width={index === lines - 2 ? '55%' : '90%'} height={11} />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.bgAlt },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  lines: { flex: 1, gap: 7 },
  list: { gap: 12 },
});
