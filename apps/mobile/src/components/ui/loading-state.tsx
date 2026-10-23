import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './app-text';

export function LoadingState({ message = 'Cargando…' }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.brand} />
      <AppText variant="caption" color={colors.muted}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
});
