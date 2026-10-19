import { config } from '../config';
import { AppError } from '../errors';

interface GeocodeInput {
  addressLine: string;
  city: string;
  country: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Geocodifica con Google si hay API key; en desarrollo usa Nominatim (OSM)
 * para no depender de una key. El proveedor es un detalle de implementación.
 */
export async function geocodeAddress(input: GeocodeInput): Promise<Coordinates> {
  const query = [input.addressLine, input.city, input.country].filter(Boolean).join(', ');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    if (config.GOOGLE_MAPS_API_KEY) {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', query);
      url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY);
      url.searchParams.set('language', 'es');

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Google Geocoding respondió ${response.status}`);
      }
      const data = (await response.json()) as {
        results?: { geometry?: { location?: { lat: number; lng: number } } }[];
      };
      const location = data.results?.[0]?.geometry?.location;
      if (!location) {
        throw new Error('Google Geocoding no encontró la dirección');
      }
      return { lat: location.lat, lng: location.lng };
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BuyersClub/0.1 (desarrollo)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Nominatim respondió ${response.status}`);
    }
    const data = (await response.json()) as { lat: string; lon: string }[];
    const first = data[0];
    if (!first) {
      throw new Error('Nominatim no encontró la dirección');
    }
    return { lat: Number(first.lat), lng: Number(first.lon) };
  } catch (error) {
    throw new AppError(
      'GEOCODING_FAILED',
      'No pudimos ubicar la dirección. Usa una dirección más específica o envía las coordenadas.',
      422,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  } finally {
    clearTimeout(timeout);
  }
}
