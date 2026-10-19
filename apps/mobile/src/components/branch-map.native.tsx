import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { BranchMapProps } from './branch-map.types';

const DEFAULT_REGION = {
  latitude: 4.6486,
  longitude: -74.0628,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function BranchMap({ branches, onSelect, height = 260 }: BranchMapProps) {
  const first = branches[0];
  const initialRegion = first
    ? {
        latitude: first.lat,
        longitude: first.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : DEFAULT_REGION;

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      >
        {branches.map((branch) => (
          <Marker
            key={branch.id}
            coordinate={{ latitude: branch.lat, longitude: branch.lng }}
            title={branch.name}
            description={branch.isOpen ? 'Abierta' : 'Cerrada'}
            onPress={() => onSelect?.(branch.id)}
          />
        ))}
      </MapView>
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
});
