import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, webCursor } from '../../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: IconName;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Control segmentado con contador, ideal para filtrar pedidos y secciones. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && styles.pressed,
              webCursor,
            ]}
          >
            {option.icon ? (
              <Icon
                name={option.icon}
                size={14}
                color={selected ? colors.brandDark : colors.muted}
              />
            ) : null}
            <AppText
              variant="caption"
              color={selected ? colors.brandDark : colors.muted}
              style={[styles.label, selected && styles.labelSelected]}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
            {typeof option.count === 'number' ? (
              <View style={[styles.count, selected && styles.countSelected]}>
                <AppText
                  variant="micro"
                  color={selected ? colors.brandDark : colors.muted}
                  style={styles.countText}
                >
                  {option.count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.bgAlt,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  segmentSelected: { backgroundColor: colors.surface },
  label: { fontWeight: '600' },
  labelSelected: { fontWeight: '800' },
  count: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  countSelected: { backgroundColor: colors.brandSoft },
  countText: { fontSize: 10, lineHeight: 13 },
  pressed: { opacity: 0.75 },
});
