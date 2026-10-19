import { useEffect, useRef, useState } from 'react';
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
}

type MapsWindow = Window & {
  google?: GoogleMapsApi;
  __buyersclubMaps?: Promise<GoogleMapsApi>;
};

const DEFAULT_CENTER = { lat: 4.6486, lng: -74.0628 };
const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function loadGoogleMaps(): Promise<GoogleMapsApi> {
  const target = window as unknown as MapsWindow;
  if (target.google?.Map) {
    return Promise.resolve(target.google);
  }
  if (target.__buyersclubMaps) {
    return target.__buyersclubMaps;
  }
  if (!KEY) {
    return Promise.reject(new Error('Falta EXPO_PUBLIC_GOOGLE_MAPS_API_KEY en el .env.'));
  }

  const promise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&language=es&region=CO`;
    script.async = true;
    script.onload = () => {
      if (target.google?.Map) {
        resolve(target.google);
      } else {
        reject(new Error('Google Maps cargó pero no expuso la API.'));
      }
    };
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps.'));
    document.head.appendChild(script);
  });

  target.__buyersclubMaps = promise;
  return promise;
}

export function BranchMap({ branches, onSelect, height = 260 }: BranchMapProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!container) {
      return;
    }

    loadGoogleMaps()
      .then((api) => {
        if (cancelled) {
          return;
        }
        const node = container;
        if (!node) {
          return;
        }

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
        ref={(node) => setContainer(node as unknown as HTMLElement | null)}
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
