import type { OrderStatus } from './orders';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Recibido',
  awaiting_payment: 'Esperando pago',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo para recoger',
  out_for_delivery: 'En camino',
  completed: 'Entregado',
  cancelled: 'Cancelado',
  rejected: 'Rechazado',
};

export type StatusTone = 'green' | 'amber' | 'blue' | 'red' | 'gray';

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  pending: 'amber',
  awaiting_payment: 'amber',
  accepted: 'blue',
  preparing: 'blue',
  ready: 'green',
  out_for_delivery: 'blue',
  completed: 'green',
  cancelled: 'red',
  rejected: 'red',
};

export function toneStyles(tone: StatusTone): { background: string; text: string } {
  switch (tone) {
    case 'green':
      return { background: '#DCFCE7', text: '#166534' };
    case 'amber':
      return { background: '#FEF3C7', text: '#92400E' };
    case 'blue':
      return { background: '#DBEAFE', text: '#1E40AF' };
    case 'red':
      return { background: '#FEE2E2', text: '#991B1B' };
    default:
      return { background: '#E5E7EB', text: '#374151' };
  }
}
