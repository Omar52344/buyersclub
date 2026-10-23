import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, type as typography } from '../../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  secure?: boolean;
  inputRef?: React.Ref<TextInputInstance>;
  containerStyle?: StyleProp<ViewStyle>;
  optional?: boolean;
}

/**
 * Campo de texto con label, icono, estados de foco/error y mostrar contraseña.
 * Mantiene el foco visible también en web.
 */
export function TextField({
  label,
  hint,
  error,
  icon,
  secure = false,
  inputRef,
  containerStyle,
  optional = false,
  multiline = false,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="label" color={colors.textSoft}>
            {label}
          </AppText>
          {optional ? (
            <AppText variant="caption" color={colors.subtle}>
              Opcional
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          !!error && styles.inputShellError,
          multiline && styles.inputShellMultiline,
        ]}
      >
        {icon ? (
          <Icon name={icon} size={18} color={focused ? colors.brand : colors.subtle} />
        ) : null}
        <TextInput
          {...inputProps}
          ref={inputRef}
          multiline={multiline}
          secureTextEntry={secure && !visible}
          placeholderTextColor={colors.subtle}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            onPress={() => setVisible((current) => !current)}
            style={styles.eye}
          >
            <Icon
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.messageRow}>
          <Icon name="alert-circle" size={13} color={colors.danger} />
          <AppText variant="caption" color={colors.danger} style={styles.message}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" color={colors.muted} style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputShellFocused: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  inputShellError: { borderColor: colors.danger },
  inputShellMultiline: { minHeight: 96, alignItems: 'flex-start', paddingVertical: 12 },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    paddingVertical: 12,
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as object) : null),
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  eye: { padding: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  message: { flex: 1 },
  hint: { lineHeight: 17 },
});
