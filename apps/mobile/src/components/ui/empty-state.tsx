import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';
import { AppText } from './app-text';
import { Button } from './button';
import { Icon, type IconName } from './icon';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: IconName;
  compact?: boolean;
}

/** Estado vacío accionable: nunca dejar al usuario en un callejón sin salida. */
export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={compact ? 26 : 34} color={colors.brand} />
      </View>
      <AppText variant={compact ? 'h3' : 'h2'} align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="body" color={colors.muted} align="center" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          icon={actionIcon}
          variant="primary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  compact: { paddingVertical: 26 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  description: { maxWidth: 380 },
  action: { alignSelf: 'center', marginTop: 8 },
});
