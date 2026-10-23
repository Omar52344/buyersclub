import type { OrderStatus } from './orders';

/** Fechas legibles y consistentes en toda la app (es-CO). */
export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeLabel(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) {
    return 'Ahora mismo';
  }
  if (minutes < 60) {
    return `Hace ${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Hace ${hours} h`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `Hace ${days} d`;
  }
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export function distanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '—';
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Iniciales para avatares (nombre, empresa o correo). */
export function initialsOf(value: string | null | undefined): string {
  const clean = (value ?? '').trim();
  if (!clean) {
    return 'BC';
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const single = parts[0] ?? '';
    return single.slice(0, 1).toUpperCase();
  }
  return `${parts[0]?.slice(0, 1) ?? ''}${parts[parts.length - 1]?.slice(0, 1) ?? ''}`.toUpperCase();
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  const clean = (fullName ?? '').trim();
  return clean ? (clean.split(/\s+/)[0] ?? null) : null;
}

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'awaiting_payment',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
];

export function isActiveOrder(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

/** Descripción humana del estado, usada en el tracker del pedido. */
export const ORDER_STATUS_HINTS: Record<OrderStatus, string> = {
  pending: 'La tienda recibió tu pedido y lo está revisando.',
  awaiting_payment: 'Falta confirmar el pago para continuar.',
  accepted: 'La tienda aceptó tu pedido.',
  preparing: 'Están preparando tus productos.',
  ready: 'Tu pedido está listo. ¡Ya puedes recogerlo!',
  out_for_delivery: 'Tu pedido va en camino.',
  completed: 'Pedido entregado. ¡Buen provecho!',
  cancelled: 'Este pedido fue cancelado.',
  rejected: 'La tienda no pudo aceptar este pedido.',
};
