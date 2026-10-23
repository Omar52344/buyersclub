import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, webCursor } from '../../theme';
import { AppText } from './app-text';
import { Icon } from './icon';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

/** Selector de cantidad con objetivos táctiles de 36–40 px. */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = 'sm',
  disabled = false,
}: QuantityStepperProps) {
  const dimension = size === 'md' ? 40 : 32;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quitar una unidad"
        accessibilityState={{ disabled: disabled || value <= min }}
        disabled={disabled || value <= min}
        hitSlop={6}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={({ pressed }) => [
          styles.button,
          { width: dimension, height: dimension },
          (disabled || value <= min) && styles.buttonDisabled,
          pressed && styles.pressed,
          webCursor,
        ]}
      >
        <Icon
          name={value <= min ? 'trash-outline' : 'remove'}
          size={size === 'md' ? 19 : 16}
          color={value <= min ? colors.danger : colors.text}
        />
      </Pressable>
      <AppText variant="bodyStrong" style={styles.value}>
        {value}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Agregar una unidad"
        accessibilityState={{ disabled: disabled || value >= max }}
        disabled={disabled || value >= max}
        hitSlop={6}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={({ pressed }) => [
          styles.button,
          styles.add,
          { width: dimension, height: dimension },
          disabled && styles.buttonDisabled,
          pressed && styles.pressed,
          webCursor,
        ]}
      >
        <Icon name="add" size={size === 'md' ? 19 : 16} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { backgroundColor: colors.brand, borderColor: colors.brand },
  buttonDisabled: { opacity: 0.45 },
  value: { minWidth: 22, textAlign: 'center', fontSize: 15 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.7 },
});
