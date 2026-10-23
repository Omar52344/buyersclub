import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../components/ui/app-text';
import { EmptyState } from '../components/ui/empty-state';
import { Screen } from '../components/ui/screen';
import { colors } from '../theme';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen
      maxWidth={520}
      scroll={false}
      edges={['top', 'bottom']}
      contentContainerStyle={styles.content}
    >
      <View style={styles.wrap}>
        <EmptyState
          icon="compass-outline"
          title="Esta página no existe"
          description="La ruta que buscas no está disponible. Vuelve al inicio y sigue explorando."
          actionLabel="Volver al inicio"
          actionIcon="home-outline"
          onAction={() => router.replace('/')}
        />
        <AppText variant="caption" color={colors.subtle} align="center">
          ClubSellBuy · Comercio local
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  wrap: { justifyContent: 'center', gap: 16 },
});
