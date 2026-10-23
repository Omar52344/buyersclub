import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, type as typography } from '../../theme';

type Variant = keyof typeof typography;

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/**
 * Texto con la escala tipográfica de la app. Evita que cada pantalla invente
 * tamaños y pesos distintos.
 */
export function AppText({
  variant = 'body',
  color = colors.text,
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[typography[variant], { color, textAlign: align }, style]}
      allowFontScaling
    >
      {children}
    </Text>
  );
}
