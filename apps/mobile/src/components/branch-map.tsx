import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BranchMapProps } from './branch-map.types';

interface GoogleBounds {
  extend(position: { lat: number; lng: number }): void;
}

interface GoogleMapInstance {
  fitBounds(bounds: GoogleBounds): void;
  setCenter(position: { lat: number; lng: number }): void;
}

interface GoogleMarker {
  addListener(event: string, handler: () => void): void;
}

interface GoogleMapsApi {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  LatLngBounds: new () => GoogleBounds;
  importLibrary?: (name: string) => Promise<unknown>;
}

type MapsWindow = Window & {
  google?: { maps?: GoogleMapsApi };
  __buyersclubMaps?: Promise<GoogleMapsApi>;
  __buyersclubMapsReady?: () => void;
};

const DEFAULT_CENTER = { lat: 4.6486, lng: -74.0628 };
const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function loadGoogleMaps(): Promise<GoogleMapsApi> {
  const target = window as unknown as MapsWindow;
  const existing = target.google?.maps;
  if (existing?.Map) {
    return Promise.resolve(existing);
  }
  if (target.__buyersclubMaps) {
    return target.__buyersclubMaps;
  }
  if (!KEY) {
    return Promise.reject(new Error('Falta EXPO_PUBLIC_GOOGLE_MAPS_API_KEY en el .env.'));
  }

  const promise = new Promise<GoogleMapsApi>((resolve, reject) => {
    let settled = false;

    const finish = (maps: GoogleMapsApi | undefined) => {
      if (settled) {
        return;
      }
      if (!maps) {
        settled = true;
        reject(new Error('Google Maps no expuso google.maps.'));
        return;
      }

      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (maps.Map) {
          resolve(maps);
        } else {
          reject(new Error('Google Maps cargó pero no expuso google.maps.Map.'));
        }
      };

      if (maps.Map) {
        done();
        return;
      }

      // Con loading=async las clases se cargan bajo demanda.
      if (typeof maps.importLibrary === 'function') {
        maps
          .importLibrary('maps')
          .then(done)
          .catch(() => {
            if (!settled) {
              settled = true;
              reject(new Error('No se pudo inicializar la librería de mapas.'));
            }
          });
        return;
      }

      done();
    };

    const callbackName = '__buyersclubMapsReady';
    target.__buyersclubMapsReady = () => finish(target.google?.maps);

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}` +
      `&language=es&region=CO&loading=async&v=weekly&callback=${callbackName}`;
    script.async = true;
    script.onload = () => {
      // El callback oficial debería resolver; este respaldo cubre navegadores
      // que no lo invocan.
      setTimeout(() => finish(target.google?.maps), 150);
    };
    script.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error('No se pudo cargar el script de Google Maps.'));
    };
    document.head.appendChild(script);

    setTimeout(() => finish(target.google?.maps), 8000);
  });

  target.__buyersclubMaps = promise;
  promise.catch(() => {
    delete target.__buyersclubMaps;
  });
  return promise;
}

export function BranchMap({ branches, onSelect, height = 260 }: BranchMapProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);
  const setMapNode = useCallback((node: unknown) => {
    setContainer(node as HTMLElement | null);
  }, []);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    if (!container) {
      return;
    }

    loadGoogleMaps()
      .then((api) => {
        if (cancelled) {
          return;
        }
        setError(null);
        const node = container;
        if (!node) {
          return;
        }

        try {
          const first = branches[0];
          const map = new api.Map(node, {
            center: first ? { lat: first.lat, lng: first.lng } : DEFAULT_CENTER,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          if (branches.length === 0) {
            return;
          }

          const bounds = new api.LatLngBounds();
          for (const branch of branches) {
            bounds.extend({ lat: branch.lat, lng: branch.lng });
            const marker = new api.Marker({
              position: { lat: branch.lat, lng: branch.lng },
              map,
              title: branch.name,
            });
            marker.addListener('click', () => onSelectRef.current?.(branch.id));
          }

          if (branches.length > 1) {
            map.fitBounds(bounds);
          } else if (first) {
            map.setCenter({ lat: first.lat, lng: first.lng });
          }
        } catch (caught) {
          if (!cancelled) {
            setError(
              caught instanceof Error
                ? `No se pudo dibujar el mapa: ${caught.message}`
                : 'No se pudo dibujar el mapa.',
            );
          }
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'No se pudo cargar el mapa.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branches, container]);

  return (
    <View style={[styles.container, { height }]}>
      <View
        ref={setMapNode}
        style={styles.map}
      />
      {error ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E6F4F1',
    borderWidth: 1,
    borderColor: '#BFE3DC',
  },
  map: { flex: 1 },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#E6F4F1',
  },
  errorText: { color: '#115E59', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
