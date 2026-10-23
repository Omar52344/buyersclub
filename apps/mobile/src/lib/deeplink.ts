const ALLOWED_PATHS = new Set([
  '/home',
  '/explore',
  '/orders',
  '/order',
  '/cart',
  '/store',
  '/settings',
  '/notifications',
  '/chat',
  '/my-dashboard',
  '/vendor',
  '/vendor-orders',
  '/vendor-dashboard',
]);

/** Acepta solo rutas internas conocidas; evita abrir URLs arbitrarias desde push. */
export function safeDeeplink(value: string): string | null {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  const path = value.split(/[?#]/)[0];
  return ALLOWED_PATHS.has(path) ? value : null;
}
