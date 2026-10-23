import { type ReactElement, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useResponsive } from '../../lib/responsive';
import { colors, layout, spacing } from '../../theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
  edges?: Edge[];
  refreshControl?: ReactElement;
  footer?: ReactNode;
  /** Espacio extra al final del scroll (útil con barras flotantes). */
  bottomInset?: number;
  keyboardAvoiding?: boolean;
  showsVerticalScrollIndicator?: boolean;
}

/**
 * Contenedor base de todas las pantallas: safe area, ancho máximo en web y
 * scroll consistente. Evita repetir el mismo andamiaje en cada archivo.
 */
export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
  style,
  maxWidth = layout.content,
  edges = ['top'],
  refreshControl,
  footer,
  bottomInset = spacing.lg,
  keyboardAvoiding = false,
  showsVerticalScrollIndicator = false,
}: ScreenProps) {
  const { gutter } = useResponsive();

  const contentStyle: StyleProp<ViewStyle> = [
    styles.content,
    {
      paddingHorizontal: gutter,
      paddingBottom: bottomInset,
      maxWidth,
    },
    contentContainerStyle,
  ];

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  const footerNode = footer ? (
    <View style={[styles.footer, { paddingHorizontal: gutter }]}>
      <View style={[styles.footerInner, { maxWidth }]}>{footer}</View>
    </View>
  ) : null;

  const content = (
    <>
      {body}
      {footerNode}
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  footerInner: { width: '100%', alignSelf: 'center' },
});
