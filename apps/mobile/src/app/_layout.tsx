import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { CartProvider } from '../lib/cart';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CartProvider>
        <NotificationTapHandler />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </CartProvider>
    </SafeAreaProvider>
  );
}


function NotificationTapHandler() {
  const router = useRouter();
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { deeplink?: unknown };
      if (typeof data?.deeplink === 'string') {
        router.push(data.deeplink);
      }
    });
    return () => subscription.remove();
  }, [router]);
  return null;
}
