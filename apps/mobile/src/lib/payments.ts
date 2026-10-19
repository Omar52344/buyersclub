import { authedRequest } from './authed';
import type { OrderDetail } from './orders';

export async function submitPaymentEvidence(
  orderId: string,
  fileId: string,
  note?: string,
): Promise<OrderDetail> {
  const response = await authedRequest<{ order: OrderDetail }>(
    `/v1/orders/${encodeURIComponent(orderId)}/payment-evidence`,
    { method: 'POST', body: JSON.stringify({ fileId, note }) },
  );
  return response.order;
}

export async function validatePayment(paymentId: string): Promise<OrderDetail> {
  const response = await authedRequest<{ order: OrderDetail }>(
    `/v1/payments/${encodeURIComponent(paymentId)}/validate`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.order;
}

export async function rejectPayment(
  paymentId: string,
  reason: string,
): Promise<OrderDetail> {
  const response = await authedRequest<{ order: OrderDetail }>(
    `/v1/payments/${encodeURIComponent(paymentId)}/reject`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
  return response.order;
}
