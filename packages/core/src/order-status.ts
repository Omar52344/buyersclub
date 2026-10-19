export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
  'rejected',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderActor = 'buyer' | 'vendor' | 'system';

interface Transition {
  readonly to: OrderStatus;
  readonly actors: readonly OrderActor[];
}

const TRANSITIONS: Record<OrderStatus, readonly Transition[]> = {
  pending: [
    { to: 'awaiting_payment', actors: ['system'] },
    { to: 'accepted', actors: ['vendor'] },
    { to: 'rejected', actors: ['vendor'] },
    { to: 'cancelled', actors: ['buyer'] },
  ],
  awaiting_payment: [
    { to: 'accepted', actors: ['vendor', 'system'] },
    { to: 'cancelled', actors: ['buyer'] },
  ],
  accepted: [
    { to: 'preparing', actors: ['vendor'] },
    { to: 'rejected', actors: ['vendor'] },
  ],
  preparing: [
    { to: 'ready', actors: ['vendor'] },
    { to: 'out_for_delivery', actors: ['vendor'] },
    { to: 'rejected', actors: ['vendor'] },
  ],
  ready: [{ to: 'completed', actors: ['vendor'] }],
  out_for_delivery: [{ to: 'completed', actors: ['vendor'] }],
  completed: [],
  cancelled: [],
  rejected: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  return TRANSITIONS[from].some(
    (transition) => transition.to === to && transition.actors.includes(actor),
  );
}

export function nextStatuses(from: OrderStatus, actor: OrderActor): OrderStatus[] {
  return TRANSITIONS[from]
    .filter((transition) => transition.actors.includes(actor))
    .map((transition) => transition.to);
}

export function isFinalStatus(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'rejected';
}

export function assertTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): void {
  if (!canTransition(from, to, actor)) {
    throw new Error(`Transición no permitida: ${from} → ${to} por ${actor}.`);
  }
}

export const PAYMENT_STATUSES = [
  'pending',
  'evidence_submitted',
  'validated',
  'rejected',
  'refunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
