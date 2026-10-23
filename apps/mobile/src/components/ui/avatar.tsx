import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';
import { initialsOf } from '../../lib/format';
import { AppText } from './app-text';

const tints = [
  { bg: '#CCFBF1', fg: '#115E59' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#DBEAFE', fg: '#1E40AF' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
  { bg: '#DCFCE7', fg: '#166534' },
];

function tintFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return tints[hash % tints.length] ?? tints[0]!;
}

interface AvatarProps {
  name: string | null | undefined;
  size?: number;
  square?: boolean;
  icon?: React.ReactNode;
}

export function Avatar({ name, size = 44, square = false, icon }: AvatarProps) {
  const tint = tintFor(name ?? 'ClubSellBuy');
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: square ? radius.md : radius.pill,
          backgroundColor: tint.bg,
        },
      ]}
    >
      {icon ?? (
        <AppText
          variant="bodyStrong"
          color={tint.fg}
          style={{ fontSize: Math.round(size * 0.34) }}
        >
          {initialsOf(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surface },
});
