import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CartProvider } from '../lib/cart';
import { safeDeeplink } from '../lib/deeplink';
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
  const initialHandled = useRef(false);

  useEffect(() => {
    // Las notificaciones push todavía no están soportadas en web.
    if (Platform.OS === 'web') {
      return;
    }

    function redirect(response: Notifications.NotificationResponse | null) {
      if (!response) {
        return;
      }
      // Consumimos la respuesta una sola vez, aunque no traiga deeplink.
      Notifications.clearLastNotificationResponse();
      const data = response.notification.request.content.data as { deeplink?: unknown };
      if (typeof data?.deeplink === 'string') {
        const target = safeDeeplink(data.deeplink);
        if (target) {
          router.push(target);
        }
      }
    }

    // Aviso que abrió la app desde cero (app cerrada o en segundo plano).
    if (!initialHandled.current) {
      initialHandled.current = true;
      redirect(Notifications.getLastNotificationResponse());
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(redirect);
    return () => subscription.remove();
  }, [router]);
  return null;
}
