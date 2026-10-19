import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pantalla no encontrada</Text>
      <Text style={styles.text}>La ruta que buscas no existe en BuyersClub.</Text>
      <Link href="/" style={styles.link}>
        Volver al inicio
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  text: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  link: {
    marginTop: spacing.md,
    color: colors.brand,
    fontWeight: '700',
    fontSize: 15,
  },
});
