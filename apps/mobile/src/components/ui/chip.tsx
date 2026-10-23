import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, radius, webCursor } from '../../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  count?: number;
}

export function Chip({ label, selected = false, onPress, icon, count }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
        webCursor,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={14} color={selected ? colors.onBrand : colors.muted} />
      ) : null}
      <AppText variant="caption" color={selected ? colors.onBrand : colors.muted} style={styles.label}>
        {label}
      </AppText>
      {typeof count === 'number' ? (
        <AppText
          variant="micro"
          color={selected ? colors.onBrand : colors.muted}
          style={[styles.count, selected && styles.countSelected]}
        >
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}

interface ChipRowProps {
  children: React.ReactNode;
}

/** Fila horizontal de filtros con scroll y sin barra visible. */
export function ChipRow({ children }: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.rowScroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowScroll: { marginHorizontal: -2 },
  row: { gap: 8, paddingVertical: 2, paddingHorizontal: 2, flexGrow: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
    minHeight: 36,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  label: { fontWeight: '600' },
  count: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  countSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
  pressed: { opacity: 0.8 },
});
