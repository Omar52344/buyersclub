import { StyleSheet, Text, View } from 'react-native';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, toneStyles } from '../lib/order-labels';
import type { OrderStatus } from '../lib/orders';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = toneStyles(ORDER_STATUS_TONES[status]);
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text }]}>{ORDER_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '800' },
});
