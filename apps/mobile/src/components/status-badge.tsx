import type { OrderStatus } from '../lib/orders';
import { colors } from '../theme';
import { Badge } from './ui/badge';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<OrderStatus, Tone> = {
  pending: 'warning',
  awaiting_payment: 'warning',
  accepted: 'info',
  preparing: 'info',
  ready: 'success',
  out_for_delivery: 'info',
  completed: 'success',
  cancelled: 'danger',
  rejected: 'danger',
};

const LABELS: Record<OrderStatus, string> = {
  pending: 'Recibido',
  awaiting_payment: 'Esperando pago',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo',
  out_for_delivery: 'En camino',
  completed: 'Entregado',
  cancelled: 'Cancelado',
  rejected: 'Rechazado',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge label={LABELS[status]} tone={TONES[status]} dot />;
}

/** Color plano del estado, para bordes y timelines. */
export function statusColor(status: OrderStatus): string {
  switch (TONES[status]) {
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'info':
      return colors.info;
    default:
      return colors.brand;
  }
}
